//DEV NOTE : Friends 1v1 ... pregame lobby (should include "READY" , "MIC FOR TRASH TALK" , "SCREENS SIDE BY SIDE") 


"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, getPlayerId, type Room } from "@/lib/supabase";

interface Props { roomId: string; }

type LobbyState = "camera_prompt" | "connecting" | "waiting" | "lobby" | "countdown" | "error";

// ── sessionStorage helpers ─────────────────────────────────────────
// We persist lobby state so refresh doesn't reset anything
function saveSession(key: string, value: string) {
  try { sessionStorage.setItem(key, value); } catch {}
}
function loadSession(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function clearSession(roomId: string) {
  try {
    sessionStorage.removeItem(`lobby_timer_start_${roomId}`);
    sessionStorage.removeItem(`lobby_ready_${roomId}`);
  } catch {}
}

const LOBBY_DURATION = 15; // seconds

export default function LobbyClient({ roomId }: Props) {
  const router   = useRouter();
  const playerId = getPlayerId();

  const localVideoRef  = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const pcRef          = useRef<RTCPeerConnection | null>(null);
  const isHostRef      = useRef(false);
  const makingOfferRef = useRef(false);
  const micTrackRef    = useRef<MediaStreamTrack | null>(null);

  const [lobbyState,  setLobbyState]  = useState<LobbyState>("camera_prompt");
  const [isHost,      setIsHost]      = useState(false);
  const [myReady,     setMyReady]     = useState(false);
  const [oppReady,    setOppReady]    = useState(false);
  const [countdown,   setCountdown]   = useState(3);
  const [copied,      setCopied]      = useState(false);
  const [error,       setError]       = useState("");
  const [lobbyTimer,  setLobbyTimer]  = useState(LOBBY_DURATION);
  const [cameraErr,   setCameraErr]   = useState("");
  const [remoteReady,    setRemoteReady]    = useState(false);
  const [isMuted,        setIsMuted]        = useState(false);
  const [oppSpeaking,    setOppSpeaking]    = useState(false);
  const [oppCameraIssue, setOppCameraIssue] = useState(false);

  const inviteUrl = typeof window !== "undefined"
    ? `${window.location.origin}/room/${roomId}` : "";

  // ── Calculate remaining lobby time from saved start timestamp ────
  function getRemainingLobbyTime(): number {
    const savedStart = loadSession(`lobby_timer_start_${roomId}`);
    if (!savedStart) return LOBBY_DURATION;
    const elapsed = (Date.now() - parseInt(savedStart)) / 1000;
    const remaining = Math.max(0, LOBBY_DURATION - elapsed);
    return Math.ceil(remaining);
  }

  // ── Callback refs ────────────────────────────────────────────────
  const setLocalVideoRef = useCallback((el: HTMLVideoElement | null) => {
    localVideoRef.current = el;
    if (el && streamRef.current) {
      const videoOnly = new MediaStream(streamRef.current.getVideoTracks());
      if (el.srcObject !== videoOnly) {
        el.srcObject = videoOnly;
        el.onloadedmetadata = () => { el.play().catch(() => {}); };
      }
    }
  }, []);

  const setRemoteVideoRef = useCallback((el: HTMLVideoElement | null) => {
    remoteVideoRef.current = el;
  }, []);

  // ── Request camera + mic ─────────────────────────────────────────
  const requestCamera = useCallback(async () => {
    setCameraErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 },
                 frameRate: { ideal: 15 }, facingMode: "user" },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      const micTrack = stream.getAudioTracks()[0];
      if (micTrack) micTrackRef.current = micTrack;

      const vid = localVideoRef.current;
      if (vid) {
        const videoOnly = new MediaStream(stream.getVideoTracks());
        vid.srcObject = videoOnly;
        vid.onloadedmetadata = () => { vid.play().catch(() => {}); };
      }

 // Notify Supabase that this player resolved their camera issue
      try {
        await supabase.from("rooms")
          .update({ [`${isHostRef.current ? "host" : "guest"}_camera_ok`]: true })
          .eq("id", roomId);
      } catch {} // fire and forget, column may not exist yet — that's ok

      setLobbyState("connecting");
      await initRoom();
    } catch {
      // Fallback to video only if mic denied
      try {
        const videoOnly = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 },
                   frameRate: { ideal: 15 }, facingMode: "user" },
          audio: false,
        });
        streamRef.current = videoOnly;
        const vid = localVideoRef.current;
        if (vid) {
          vid.srcObject = videoOnly;
          vid.onloadedmetadata = () => { vid.play().catch(() => {}); };
        }
        setLobbyState("connecting");
        await initRoom();
      } catch (err2) {
        const msg = err2 instanceof Error ? err2.message : "Permission denied";
        setCameraErr(
          msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("permission")
            ? "Camera permission denied. Please allow camera access and try again."
            : "Could not access camera: " + msg
        );
        // Tell opponent we're having camera issues
        setOppCameraIssue(false); // this is MY issue, not theirs
      }
    }
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mute toggle ──────────────────────────────────────────────────
  function toggleMute() {
    const micTrack = micTrackRef.current;
    if (!micTrack) return;
    micTrack.enabled = !micTrack.enabled;
    setIsMuted(!micTrack.enabled);
  }

  // ── Voice activity detection ─────────────────────────────────────
  function startVAD(stream: MediaStream) {
    try {
      const audioCtx = new AudioContext();
      const source   = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const check = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setOppSpeaking(avg > 10);
        requestAnimationFrame(check);
      };
      check();
    } catch {}
  }

  // ── WebRTC ───────────────────────────────────────────────────────
  function createPeerConnection() {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turn:openrelay.metered.ca:443",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
        {
          urls: "turns:openrelay.metered.ca:443?transport=tcp",
          username: "openrelayproject",
          credential: "openrelayproject",
        },
      ],
    });

    streamRef.current?.getTracks().forEach(track => {
      pc.addTrack(track, streamRef.current!);
    });

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (event.track.kind === "video") {
        setRemoteReady(true);
        const vid = remoteVideoRef.current;
        if (vid) {
          const videoOnly = new MediaStream(remoteStream.getVideoTracks());
          vid.srcObject = videoOnly;
          vid.muted = true;
          vid.onloadedmetadata = () => { vid.play().catch(() => {}); };
        }
      }
      if (event.track.kind === "audio") {
        const audioEl = remoteAudioRef.current;
        if (audioEl) {
          const audioOnly = new MediaStream([event.track]);
          audioEl.srcObject = audioOnly;
          audioEl.muted = false;
          audioEl.play().catch(() => {});
          startVAD(audioOnly);
        }
      }
    };

    pc.onicecandidate = async (event) => {
      if (!event.candidate) return;
      await supabase.from("signals").insert({
        room_id: roomId, from_id: playerId,
        to_id: isHostRef.current ? "guest" : "host",
        type: "ice", payload: event.candidate.toJSON(),
      });
    };

    pcRef.current = pc;
    return pc;
  }

  async function createOffer(pc: RTCPeerConnection) {
    makingOfferRef.current = true;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await supabase.from("signals").insert({
        room_id: roomId, from_id: playerId, to_id: "guest",
        type: "offer", payload: { type: offer.type, sdp: offer.sdp },
      });
    } finally { makingOfferRef.current = false; }
  }

  async function handleOffer(pc: RTCPeerConnection, payload: Record<string, unknown>) {
    await pc.setRemoteDescription(
      new RTCSessionDescription(payload as unknown as RTCSessionDescriptionInit)
    );
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await supabase.from("signals").insert({
      room_id: roomId, from_id: playerId, to_id: "host",
      type: "answer", payload: { type: answer.type, sdp: answer.sdp },
    });
  }

  async function handleAnswer(pc: RTCPeerConnection, payload: Record<string, unknown>) {
    if (pc.signalingState === "stable") return;
    await pc.setRemoteDescription(
      new RTCSessionDescription(payload as unknown as RTCSessionDescriptionInit)
    );
  }

  async function handleIce(pc: RTCPeerConnection, payload: Record<string, unknown>) {
    try {
      await pc.addIceCandidate(
        new RTCIceCandidate(payload as unknown as RTCIceCandidateInit)
      );
    } catch { if (!makingOfferRef.current) console.warn("ICE error"); }
  }

  function subscribeToSignals(pc: RTCPeerConnection, myRole: "host" | "guest") {
    supabase
      .channel(`signals:${roomId}:${myRole}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public",
        table: "signals", filter: `room_id=eq.${roomId}`,
      }, async (payload) => {
        const signal = payload.new as {
          to_id: string; type: string; payload: Record<string, unknown>;
        };
        if (signal.to_id !== myRole) return;
        if      (signal.type === "offer")  await handleOffer(pc, signal.payload);
        else if (signal.type === "answer") await handleAnswer(pc, signal.payload);
        else if (signal.type === "ice")    await handleIce(pc, signal.payload);
      })
      .subscribe();
  }

  // ── Init room ────────────────────────────────────────────────────
  const initRoom = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("rooms").select("*").eq("id", roomId).single();

    if (err || !data) {
      // Create new room
      const { error: createErr } = await supabase.from("rooms").insert({
        id: roomId, host_id: playerId, status: "waiting",
      });
      if (createErr) {
        setError("Failed to create room: " + createErr.message);
        setLobbyState("error"); return;
      }
      isHostRef.current = true;
      setIsHost(true);
      setLobbyState("waiting");
      return;
    }

    const room = data as Room;

    // ── Battle already started → go straight there ───────────────
    if (room.status === "battle") {
      router.push(`/battle/${roomId}?fresh=1`); return;
    }
    if (room.status === "finished") {
      setError("This match is already over."); setLobbyState("error"); return;
    }

    // ── Countdown already running → jump to countdown ────────────
    if (room.status === "countdown") {
      setLobbyState("countdown");
      runCountdown(); return;
    }

    if (room.host_id === playerId) {
      // HOST
      isHostRef.current = true;
      setIsHost(true);
      setMyReady(room.host_ready);
      setOppReady(room.guest_ready);

      // ── REFRESH RECOVERY: restore ready state ────────────────
      const savedReady = loadSession(`lobby_ready_${roomId}`);
      if (savedReady === "true" && !room.host_ready) {
        await supabase.from("rooms").update({ host_ready: true }).eq("id", roomId);
        setMyReady(true);
      }

      if (room.guest_id) {
        setLobbyState("lobby");
        // Restore timer from saved timestamp
        setLobbyTimer(getRemainingLobbyTime());
        const pc = createPeerConnection();
        subscribeToSignals(pc, "host");
        await createOffer(pc);
      } else {
        setLobbyState("waiting");
      }

    } else if (!room.guest_id || room.guest_id === playerId) {
      // GUEST
      if (room.guest_id !== playerId) {
        const { error: joinErr } = await supabase.from("rooms")
          .update({ guest_id: playerId, status: "ready" }).eq("id", roomId);
        if (joinErr) {
          setError("Failed to join: " + joinErr.message); setLobbyState("error"); return;
        }
        // Save lobby start time when guest first joins
        saveSession(`lobby_timer_start_${roomId}`, Date.now().toString());
      }

      isHostRef.current = false;
      setIsHost(false);
      setMyReady(room.guest_ready);
      setOppReady(room.host_ready);

      // ── REFRESH RECOVERY: restore ready state ────────────────
      const savedReady = loadSession(`lobby_ready_${roomId}`);
      if (savedReady === "true" && !room.guest_ready) {
        await supabase.from("rooms").update({ guest_ready: true }).eq("id", roomId);
        setMyReady(true);
      }

      // Restore timer from saved timestamp
      setLobbyTimer(getRemainingLobbyTime());
      setLobbyState("lobby");
      const pc = createPeerConnection();
      subscribeToSignals(pc, "guest");

    } else {
      setError("This room is full."); setLobbyState("error");
    }
  }, [roomId, playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime: room changes ───────────────────────────────────────
  useEffect(() => {
    if (lobbyState === "camera_prompt") return;

    const channel = supabase
      .channel(`room:${roomId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public",
        table: "rooms", filter: `id=eq.${roomId}`,
      }, async (payload) => {
        const updated = payload.new as Room;

        // Guest just joined → host moves to lobby + saves timer start
        if (updated.guest_id && lobbyState === "waiting" && isHostRef.current) {
          saveSession(`lobby_timer_start_${roomId}`, Date.now().toString());
          setLobbyTimer(LOBBY_DURATION);
          setLobbyState("lobby");
          const pc = createPeerConnection();
          subscribeToSignals(pc, "host");
          await createOffer(pc);
        }

        if (isHostRef.current) {
          setMyReady(updated.host_ready);
          setOppReady(updated.guest_ready);
        } else {
          setMyReady(updated.guest_ready);
          setOppReady(updated.host_ready);
        }

        if (updated.host_ready && updated.guest_ready && updated.status === "countdown") {
          setLobbyState("countdown");
          runCountdown();
        }

        if (updated.status === "battle") {
          clearSession(roomId);
          router.push(`/battle/${roomId}?fresh=1`);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [lobbyState, roomId, router]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lobby timer — driven by real timestamp, not just countdown ──
  useEffect(() => {
    if (lobbyState !== "lobby") return;
    const interval = setInterval(() => {
      const remaining = getRemainingLobbyTime();
      setLobbyTimer(Math.ceil(remaining));
      if (remaining <= 0) clearInterval(interval);
    }, 500); // update every 500ms for accuracy
    return () => clearInterval(interval);
  }, [lobbyState]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ready up ─────────────────────────────────────────────────────
  async function handleReady() {
    if (myReady) return;
    setMyReady(true);
    // Save ready state to sessionStorage so refresh restores it
    saveSession(`lobby_ready_${roomId}`, "true");
    const field = isHost ? "host_ready" : "guest_ready";
    await supabase.from("rooms").update({ [field]: true }).eq("id", roomId);
    const { data } = await supabase.from("rooms").select("*").eq("id", roomId).single();
    if (data?.host_ready && data?.guest_ready) {
      await supabase.from("rooms").update({ status: "countdown" }).eq("id", roomId);
    }
  }

  // ── Countdown ────────────────────────────────────────────────────
  function runCountdown() {
    let n = 3; setCountdown(n);
    const tick = setInterval(async () => {
      n--; setCountdown(n);
      if (n <= 0) {
        clearInterval(tick);
        clearSession(roomId);
        if (isHostRef.current) {
          await supabase.from("rooms")
            .update({ status: "battle", started_at: new Date().toISOString() })
            .eq("id", roomId);
        }
        router.push(`/battle/${roomId}?fresh=1`);
      }
    }, 1000);
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Presence: track opponent camera status ───────────────────────
  // We use a Supabase presence channel to broadcast camera status
  // No DB changes needed — presence is ephemeral and perfect for this
  useEffect(() => {
    if (lobbyState === "camera_prompt") return;

    const presenceChannel = supabase.channel(`presence:${roomId}`, {
      config: { presence: { key: playerId } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState<{ cameraOk: boolean }>();
        const others = Object.entries(state)
          .filter(([key]) => key !== playerId)
          .map(([, val]) => val[0]);
        if (others.length > 0) {
          // If opponent is present but cameraOk is false → they have issues
          setOppCameraIssue(others[0]?.cameraOk === false);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Broadcast our camera status
          await presenceChannel.track({ cameraOk: true });
        }
      });

    return () => { supabase.removeChannel(presenceChannel); };
  }, [lobbyState, roomId, playerId]);

  // When camera fails, broadcast that to opponent
  useEffect(() => {
    if (!cameraErr) return;
    // Broadcast camera issue via presence
    const ch = supabase.channel(`presence:${roomId}`, {
      config: { presence: { key: playerId } },
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ cameraOk: false });
      }
    });
    return () => { supabase.removeChannel(ch); };
  }, [cameraErr, roomId, playerId]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      pcRef.current?.close();
    };
  }, []);

  // ── RENDER ───────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0, background: "#060606",
      fontFamily: "'DM Mono','Courier New',monospace", color: "white",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>

      {/* Hidden audio for opponent voice */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />

      {/* Header */}
      <div style={{
        padding: "12px 20px", display: "flex",
        justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0, zIndex: 10,
      }}>
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -1 }}>
          LOCKED&apos;N<span style={{ color: "#00ff88" }}>.</span>
        </div>
        <div style={{
          fontSize: 11, opacity: 0.5, letterSpacing: 2,
          background: "rgba(255,255,255,0.05)",
          padding: "4px 10px", borderRadius: 20,
        }}>
          {lobbyState === "camera_prompt" ? "CAMERA NEEDED"  :
           lobbyState === "connecting"    ? "CONNECTING..."  :
           lobbyState === "waiting"       ? "WAITING..."     :
           lobbyState === "lobby"         ? "LOBBY 🔥"       :
           lobbyState === "countdown"     ? "STARTING..."    : "ERROR"}
        </div>
      </div>

      {/* CAMERA PERMISSION */}
      {lobbyState === "camera_prompt" && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: 32, gap: 20, textAlign: "center",
        }}>
          <div style={{ fontSize: 52 }}>📷🎙️</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>
              {cameraErr ? "Permission Needed" : "Camera & Mic Required"}
            </div>
            <div style={{ fontSize: 13, opacity: 0.5, lineHeight: 1.7, maxWidth: 280 }}>
              {cameraErr
                ? "The room is still open — your opponent is waiting. Fix permissions and rejoin."
                : "Both players need camera and mic to see and trash talk each other."}
            </div>
          </div>

          {cameraErr && (
            <div style={{
              padding: "14px 16px", borderRadius: 12, fontSize: 12,
              background: "rgba(255,34,68,0.08)", border: "1px solid rgba(255,34,68,0.25)",
              color: "#ff6666", maxWidth: 320, lineHeight: 1.7, textAlign: "left",
            }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: "#ff4466" }}>
                ❌ {cameraErr}
              </div>
              <div style={{ opacity: 0.8 }}>
                <strong>How to fix:</strong><br/>
                1. Tap the 🔒 lock icon in your browser URL bar<br/>
                2. Set Camera and Microphone to <strong>Allow</strong><br/>
                3. Tap Try Again below
              </div>
            </div>
          )}

          <button onClick={requestCamera} style={{
            padding: "16px 40px", borderRadius: 14, border: 0,
            background: cameraErr
              ? "#ff4466"
              : "linear-gradient(135deg, #00ff88, #00ccff)",
            color: "#fff",
            fontSize: 16, fontWeight: 900, cursor: "pointer",
            letterSpacing: 0.5,
          }}>
            {cameraErr ? "🔄 Try Again" : "Allow Camera & Mic"}
          </button>

          {!cameraErr && (
            <div style={{ fontSize: 11, opacity: 0.3 }}>
              Camera and audio stay on your device — nothing is stored
            </div>
          )}

          {cameraErr && (
            <div style={{
              fontSize: 12, opacity: 0.4, maxWidth: 280, lineHeight: 1.6,
            }}>
              ⏳ Your opponent&apos;s room stays open. Fix permissions and tap Try Again to rejoin — no new link needed.
            </div>
          )}
        </div>
      )}

      {/* CONNECTING */}
      {lobbyState === "connecting" && (
        <div style={{
          flex: 1, display: "flex", alignItems: "center",
          justifyContent: "center", gap: 12,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00ff88" }} />
          <span style={{ opacity: 0.5, fontSize: 14 }}>Setting up room...</span>
        </div>
      )}

      {/* WAITING */}
      {lobbyState === "waiting" && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", padding: 24, gap: 20,
        }}>
          <div style={{
            width: "100%", maxWidth: 340, aspectRatio: "4/3",
            borderRadius: 16, overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.1)", background: "#111",
            position: "relative",
          }}>
            <video ref={setLocalVideoRef} playsInline muted autoPlay
              style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
            />
            <div style={{
              position: "absolute", bottom: 10, left: 10,
              background: "rgba(0,0,0,0.7)", borderRadius: 8,
              padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#00ff88",
            }}>YOU</div>
          </div>
          <div style={{
            width: "100%", maxWidth: 340, padding: 18, borderRadius: 16,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{ fontSize: 11, opacity: 0.4, letterSpacing: 2, marginBottom: 10 }}>
              SEND THIS TO YOUR OPPONENT
            </div>
            <div style={{
              background: "rgba(0,0,0,0.4)", borderRadius: 10,
              padding: "10px 12px", fontSize: 11, wordBreak: "break-all",
              opacity: 0.5, marginBottom: 12,
              border: "1px solid rgba(255,255,255,0.07)",
            }}>{inviteUrl}</div>
            <button onClick={copyInvite} style={{
              width: "100%", padding: "13px 0", borderRadius: 12,
              background: copied ? "rgba(0,255,136,0.15)" : "#00ff88",
              color: copied ? "#00ff88" : "#000",
              fontSize: 14, fontWeight: 900, cursor: "pointer",
              border: copied ? "1px solid #00ff88" : "none",
              transition: "all 0.2s",
            }}>
              {copied ? "✓ COPIED!" : "COPY INVITE LINK"}
            </button>
          </div>
          {/* Waiting status — shows different message if opp has camera issues */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 16px", borderRadius: 12,
            background: oppCameraIssue
              ? "rgba(255,204,0,0.08)"
              : "rgba(255,255,255,0.04)",
            border: oppCameraIssue
              ? "1px solid rgba(255,204,0,0.2)"
              : "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
              background: oppCameraIssue ? "#ffcc00" : "#00ff88",
              opacity: oppCameraIssue ? 1 : 0.6,
            }} />
            <span style={{
              fontSize: 12,
              color: oppCameraIssue ? "#ffcc00" : "rgba(255,255,255,0.35)",
            }}>
              {oppCameraIssue
                ? "Opponent is fixing their camera permissions..."
                : "Waiting for opponent to join..."}
            </span>
          </div>

          {/* Room link reminder — always visible while waiting */}
          <div style={{ fontSize: 11, opacity: 0.3, textAlign: "center", maxWidth: 280 }}>
            Room stays open as long as you&apos;re here. Opponent can rejoin anytime from the same link.
          </div>
        </div>
      )}

      {/* LOBBY */}
      {lobbyState === "lobby" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Top — OPPONENT */}
          <div style={{
            flex: 1, position: "relative", background: "#0d0d0d",
            overflow: "hidden", borderBottom: "2px solid rgba(255,255,255,0.08)",
          }}>
            <video ref={setRemoteVideoRef} playsInline muted autoPlay
              style={{
                width: "100%", height: "100%", objectFit: "cover",
                transform: "scaleX(-1)",
                opacity: remoteReady ? 1 : 0, transition: "opacity 0.5s",
              }}
            />
            {!remoteReady && (
              <div style={{
                position: "absolute", inset: 0, display: "flex",
                flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
              }}>
                <div style={{ fontSize: 44 }}>
                  {oppCameraIssue ? "⚠️" : "👤"}
                </div>
                <div style={{
                  fontSize: 12,
                  color: oppCameraIssue ? "#ffcc00" : "rgba(255,255,255,0.4)",
                  textAlign: "center", maxWidth: 200, lineHeight: 1.6,
                }}>
                  {oppCameraIssue
                    ? "Opponent is fixing their camera permissions..."
                    : "Connecting video..."}
                </div>
              </div>
            )}
            <div style={{
              position: "absolute", top: 10, left: 12,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, letterSpacing: 1 }}>
                OPPONENT
              </span>
              {oppSpeaking && (
                <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 14 }}>
                  {[4,8,6,10,5].map((h, i) => (
                    <div key={i} style={{
                      width: 3, height: h, borderRadius: 2, background: "#00ff88",
                      animation: `bar ${0.4 + i * 0.1}s ease-in-out infinite alternate`,
                    }} />
                  ))}
                </div>
              )}
            </div>
            <div style={{
              position: "absolute", top: 10, right: 12,
              fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 700,
              background: oppReady ? "rgba(0,255,136,0.2)" : "rgba(0,0,0,0.5)",
              color: oppReady ? "#00ff88" : "rgba(255,255,255,0.4)",
              border: `1px solid ${oppReady ? "rgba(0,255,136,0.4)" : "rgba(255,255,255,0.1)"}`,
            }}>
              {oppReady ? "✓ READY" : "not ready"}
            </div>
          </div>

          {/* Bottom — YOU */}
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            <video ref={setLocalVideoRef} playsInline muted autoPlay
              style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
            />
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.88) 100%)",
            }} />
            <div style={{
              position: "absolute", top: 10, left: 12,
              fontSize: 11, fontWeight: 700, letterSpacing: 1,
            }}>YOU</div>

            {/* Mute button */}
            <button onClick={toggleMute} style={{
              position: "absolute", top: 8, right: 12,
              padding: "6px 12px", borderRadius: 20, cursor: "pointer",
              border: `1px solid ${isMuted ? "rgba(255,34,68,0.5)" : "rgba(255,255,255,0.15)"}`,
              background: isMuted ? "rgba(255,34,68,0.15)" : "rgba(0,0,0,0.5)",
              color: isMuted ? "#ff4466" : "rgba(255,255,255,0.7)",
              fontSize: 12, fontWeight: 700,
              display: "flex", alignItems: "center", gap: 5,
              backdropFilter: "blur(8px)",
            }}>
              {isMuted ? "🔇 MUTED" : "🎙️ MIC ON"}
            </button>

            {/* Controls */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              padding: "10px 16px 20px",
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 10,
              }}>
                <div style={{ fontSize: 11, opacity: 0.4 }}>🔥 Trash talk</div>
                <div style={{
                  fontSize: 12, fontWeight: 700,
                  color: lobbyTimer <= 5 ? "#ff6644" : "rgba(255,255,255,0.4)",
                }}>
                  {lobbyTimer}s
                </div>
              </div>
              <button onClick={handleReady} disabled={myReady} style={{
                width: "100%", padding: "14px 0", borderRadius: 14,
                fontWeight: 900, fontSize: 15,
                cursor: myReady ? "default" : "pointer",
                background: myReady
                  ? "rgba(0,255,136,0.15)"
                  : "linear-gradient(135deg, #00ff88, #00ccff)",
                color: myReady ? "#00ff88" : "#000",
                border: myReady ? "1px solid rgba(0,255,136,0.3)" : "none",
                transition: "all 0.3s", letterSpacing: 1,
              }}>
                {myReady
                  ? (oppReady ? "BOTH READY — STARTING..." : "✓ READY — waiting...")
                  : "I'M READY 🔥"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COUNTDOWN */}
      {lobbyState === "countdown" && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16,
          background: "rgba(0,0,0,0.96)",
        }}>
          <div style={{ fontSize: 13, letterSpacing: 4, opacity: 0.5, fontWeight: 700 }}>
            GET READY
          </div>
          <div style={{
            fontSize: 140, fontWeight: 900, letterSpacing: -6, lineHeight: 1,
            color: countdown <= 1 ? "#00ff88" : "white",
            textShadow: countdown <= 1 ? "0 0 60px #00ff8888" : "none",
            transition: "all 0.2s",
          }}>
            {countdown}
          </div>
          <div style={{ fontSize: 12, opacity: 0.3 }}>30s pushup battle</div>
        </div>
      )}

      {/* ERROR */}
      {lobbyState === "error" && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16, padding: 24,
        }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div style={{ fontSize: 14, color: "#ff4466", textAlign: "center" }}>{error}</div>
          <button onClick={() => router.push("/")} style={{
            padding: "12px 24px", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "transparent", color: "white", fontSize: 14, cursor: "pointer",
          }}>Go Home</button>
        </div>
      )}

      <style>{`
        @keyframes bar {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1.2); }
        }
      `}</style>
    </div>
  );
}
