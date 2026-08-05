//DEV NOTE : Friends 1v1 ... pregame lobby (should include "READY" , "MIC FOR TRASH TALK" , "SCREENS SIDE BY SIDE") 



"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, getPlayerId, type Room } from "@/lib/supabase";

interface Props {
  roomId: string;
}

type LobbyState =
  | "connecting"   // loading, checking room
  | "waiting"      // host waiting for guest
  | "lobby"        // both players in, trash talk time
  | "countdown"    // both ready, counting down
  | "error";

export default function LobbyClient({ roomId }: Props) {
  const router   = useRouter();
  const playerId = getPlayerId();

  // ── Refs ────────────────────────────────────────────────────────
  const localVideoRef  = useRef<HTMLVideoElement | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const channelRef     = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── State ────────────────────────────────────────────────────────
  const [lobbyState,  setLobbyState]  = useState<LobbyState>("connecting");
  const [room,        setRoom]        = useState<Room | null>(null);
  const [isHost,      setIsHost]      = useState(false);
  const [myReady,     setMyReady]     = useState(false);
  const [oppReady,    setOppReady]    = useState(false);
  const [countdown,   setCountdown]   = useState(3);
  const [copied,      setCopied]      = useState(false);
  const [error,       setError]       = useState("");
  const [cameraOk,    setCameraOk]    = useState(false);
  const [lobbyTimer,  setLobbyTimer]  = useState(15); // trash talk timer

  const inviteUrl = typeof window !== "undefined"
    ? `${window.location.origin}/room/${roomId}`
    : "";

  // ── Start local camera ──────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 },
                 frameRate: { ideal: 15 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play();
      }
      setCameraOk(true);
    } catch {
      setError("Camera permission denied. Please allow camera access.");
    }
  }, []);

  // ── Create room (host) ──────────────────────────────────────────
  const createRoom = useCallback(async () => {
    const { error: err } = await supabase.from("rooms").insert({
      id:       roomId,
      host_id:  playerId,
      status:   "waiting",
    });
    if (err) { setError("Failed to create room: " + err.message); return; }
    setIsHost(true);
    setLobbyState("waiting");
  }, [roomId, playerId]);

  // ── Join room (guest) ───────────────────────────────────────────
  const joinRoom = useCallback(async (existingRoom: Room) => {
    if (existingRoom.guest_id && existingRoom.guest_id !== playerId) {
      setError("This room is full."); return;
    }
    if (existingRoom.status === "finished") {
      setError("This match is already over."); return;
    }
    if (existingRoom.host_id === playerId) {
      // I am the host rejoining
      setIsHost(true);
      setLobbyState(existingRoom.guest_id ? "lobby" : "waiting");
      setRoom(existingRoom);
      return;
    }
    // Guest joining for first time
    const { error: err } = await supabase.from("rooms")
      .update({ guest_id: playerId, status: "ready" })
      .eq("id", roomId);
    if (err) { setError("Failed to join room: " + err.message); return; }
    setIsHost(false);
    setLobbyState("lobby");
  }, [roomId, playerId]);

  // ── Init: check if room exists, create or join ──────────────────
  useEffect(() => {
    async function init() {
      await startCamera();

      const { data, error: err } = await supabase
        .from("rooms").select("*").eq("id", roomId).single();

      if (err || !data) {
        // Room doesn't exist → create it (host flow)
        await createRoom();
      } else {
        await joinRoom(data as Room);
        setRoom(data as Room);
      }
    }
    init();
  }, [roomId, startCamera, createRoom, joinRoom]);

  // ── Realtime: subscribe to room changes ─────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`room:${roomId}`)
      .on("postgres_changes", {
        event:  "UPDATE",
        schema: "public",
        table:  "rooms",
        filter: `id=eq.${roomId}`,
      }, (payload) => {
        const updated = payload.new as Room;
        setRoom(updated);

        // Guest just joined → move to lobby
        if (updated.guest_id && updated.status === "ready") {
          setLobbyState("lobby");
        }

        // Update ready states
        if (isHost) {
          setMyReady(updated.host_ready);
          setOppReady(updated.guest_ready);
        } else {
          setMyReady(updated.guest_ready);
          setOppReady(updated.host_ready);
        }

        // Both ready → start countdown
        if (updated.host_ready && updated.guest_ready && updated.status === "countdown") {
          setLobbyState("countdown");
          startCountdown();
        }

        // Battle started → navigate
        if (updated.status === "battle") {
          router.push(`/battle/${roomId}`);
        }
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [roomId, isHost, router]);

  // ── Lobby timer (trash talk countdown) ─────────────────────────
  useEffect(() => {
    if (lobbyState !== "lobby") return;
    if (lobbyTimer <= 0) return;
    const t = setTimeout(() => setLobbyTimer(prev => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [lobbyState, lobbyTimer]);

  // ── Ready up ────────────────────────────────────────────────────
  async function handleReady() {
    if (myReady) return;
    setMyReady(true);

    const field = isHost ? "host_ready" : "guest_ready";
    await supabase.from("rooms").update({ [field]: true }).eq("id", roomId);

    // Check if both are now ready
    const { data } = await supabase.from("rooms").select("*").eq("id", roomId).single();
    if (data?.host_ready && data?.guest_ready) {
      await supabase.from("rooms").update({ status: "countdown" }).eq("id", roomId);
    }
  }

  // ── Countdown then navigate to battle ──────────────────────────
  function startCountdown() {
    let n = 3;
    setCountdown(n);
    const tick = setInterval(async () => {
      n--;
      setCountdown(n);
      if (n <= 0) {
        clearInterval(tick);
        // Host triggers battle start
        if (isHost) {
          await supabase.from("rooms")
            .update({ status: "battle", started_at: new Date().toISOString() })
            .eq("id", roomId);
        }
        router.push(`/battle/${roomId}`);
      }
    }, 1000);
  }

  // ── Copy invite link ────────────────────────────────────────────
  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Cleanup on unmount ──────────────────────────────────────────
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0, background: "#060606",
      fontFamily: "'DM Mono','Courier New',monospace", color: "white",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: "14px 20px", display: "flex",
        justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -1 }}>
          LOCKED'N<span style={{ color: "#00ff88" }}>.</span>
        </div>
        <div style={{
          fontSize: 11, opacity: 0.4, letterSpacing: 2,
          background: "rgba(255,255,255,0.05)",
          padding: "4px 10px", borderRadius: 20,
        }}>
          {lobbyState === "waiting"   ? "WAITING FOR OPPONENT" :
           lobbyState === "lobby"     ? "LOBBY" :
           lobbyState === "countdown" ? "STARTING..." :
           lobbyState === "connecting"? "CONNECTING..." : "ERROR"}
        </div>
      </div>

      {/* ══════════════════════════════════════
          STATE: CONNECTING
      ══════════════════════════════════════ */}
      {lobbyState === "connecting" && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00ff88",
                        animation: "pulse 1s infinite" }} />
          <span style={{ opacity: 0.5, fontSize: 14 }}>Connecting...</span>
        </div>
      )}

      {/* ══════════════════════════════════════
          STATE: WAITING (host only)
      ══════════════════════════════════════ */}
      {lobbyState === "waiting" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center", padding: 24, gap: 24 }}>

          {/* My camera preview */}
          <div style={{
            width: "100%", maxWidth: 320, aspectRatio: "4/3",
            borderRadius: 16, overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.1)", background: "#111",
            position: "relative",
          }}>
            <video ref={localVideoRef} playsInline muted autoPlay style={{
              width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)",
            }} />
            <div style={{
              position: "absolute", bottom: 10, left: 10,
              background: "rgba(0,0,0,0.7)", borderRadius: 8,
              padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#00ff88",
            }}>YOU</div>
          </div>

          {/* Invite section */}
          <div style={{
            width: "100%", maxWidth: 360, padding: 20, borderRadius: 16,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{ fontSize: 11, opacity: 0.4, letterSpacing: 2, marginBottom: 12 }}>
              INVITE YOUR OPPONENT
            </div>
            <div style={{
              background: "rgba(0,0,0,0.4)", borderRadius: 10, padding: "10px 14px",
              fontSize: 12, wordBreak: "break-all", opacity: 0.6, marginBottom: 12,
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              {inviteUrl}
            </div>
            <button onClick={copyInvite} style={{
              width: "100%", padding: "13px 0", borderRadius: 12, 
              background: copied ? "rgba(0,255,136,0.15)" : "#00ff88",
              color: copied ? "#00ff88" : "#000",
              fontSize: 14, fontWeight: 900, cursor: "pointer",
              border: copied ? "1px solid #00ff88" : "none",
              transition: "all 0.2s",
            }}>
              {copied ? "✓ LINK COPIED!" : "COPY INVITE LINK"}
            </button>
          </div>

          {/* Waiting animation */}
          <div style={{ textAlign: "center", opacity: 0.4, fontSize: 13 }}>
            <div>Waiting for opponent to join...</div>
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 10 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: "50%", background: "#00ff88",
                  opacity: 0.4, animation: `pulse 1.2s ${i*0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          STATE: LOBBY (both players in)
          Option 1: Side by side cameras
      ══════════════════════════════════════ */}
      {lobbyState === "lobby" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Side by side cameras */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>

            {/* Player 1 (YOU) */}
            <div style={{ position: "relative", overflow: "hidden", background: "#0a0a0a" }}>
              <video ref={localVideoRef} playsInline muted autoPlay style={{
                width: "100%", height: "100%", objectFit: "cover",
                transform: "scaleX(-1)",
              }} />
              {/* Name tag */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                padding: "20px 14px 12px",
                background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
              }}>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1 }}>YOU</div>
                <div style={{
                  fontSize: 10, marginTop: 2,
                  color: myReady ? "#00ff88" : "rgba(255,255,255,0.4)",
                }}>
                  {myReady ? "✓ READY" : "not ready"}
                </div>
              </div>
            </div>

            {/* Player 2 (OPPONENT) — no camera yet (WebRTC next step) */}
            <div style={{
              position: "relative", background: "#0d0d0d",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 10,
            }}>
              {/* Opponent avatar placeholder */}
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "rgba(255,255,255,0.06)",
                border: "2px solid rgba(255,255,255,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24,
              }}>
                👤
              </div>
              <div style={{ fontSize: 12, opacity: 0.4 }}>OPPONENT</div>
              <div style={{
                fontSize: 10, padding: "4px 12px", borderRadius: 20,
                background: oppReady ? "rgba(0,255,136,0.15)" : "rgba(255,255,255,0.05)",
                color: oppReady ? "#00ff88" : "rgba(255,255,255,0.3)",
                border: `1px solid ${oppReady ? "rgba(0,255,136,0.3)" : "rgba(255,255,255,0.08)"}`,
              }}>
                {oppReady ? "✓ READY" : "not ready"}
              </div>

              {/* Divider line */}
              <div style={{
                position: "absolute", top: 0, left: 0, bottom: 0,
                width: 1, background: "rgba(255,255,255,0.06)",
              }} />
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{
            padding: "14px 20px 24px", flexShrink: 0,
            background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}>
            {/* Lobby timer */}
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 12,
            }}>
              <div style={{ fontSize: 11, opacity: 0.4 }}>
                🔥 Trash talk window
              </div>
              <div style={{
                fontSize: 13, fontWeight: 700,
                color: lobbyTimer <= 5 ? "#ff6644" : "rgba(255,255,255,0.5)",
              }}>
                {lobbyTimer}s
              </div>
            </div>

            {/* Ready button */}
            <button
              onClick={handleReady}
              disabled={myReady}
              style={{
                width: "100%", padding: "15px 0", borderRadius: 14, 
                fontWeight: 900, fontSize: 16, cursor: myReady ? "default" : "pointer",
                background: myReady
                  ? "rgba(0,255,136,0.15)"
                  : "linear-gradient(135deg, #00ff88, #00ccff)",
                color: myReady ? "#00ff88" : "#000",
                border: myReady ? "1px solid rgba(0,255,136,0.3)" : "none",
                transition: "all 0.3s",
                letterSpacing: 1,
              }}>
              {myReady ? "✓ READY — waiting for opponent" : "I'M READY  🔥"}
            </button>

            {/* Both ready indicator */}
            {myReady && oppReady && (
              <div style={{
                textAlign: "center", marginTop: 10,
                fontSize: 12, color: "#00ff88", fontWeight: 700,
                animation: "pulse 0.5s infinite",
              }}>
                BOTH READY — STARTING...
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          STATE: COUNTDOWN
      ══════════════════════════════════════ */}
      {lobbyState === "countdown" && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16,
          background: "rgba(0,0,0,0.95)",
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
          <div style={{ fontSize: 12, opacity: 0.3 }}>
            30s pushup battle
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          STATE: ERROR
      ══════════════════════════════════════ */}
      {lobbyState === "error" && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16, padding: 24,
        }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div style={{ fontSize: 14, color: "#ff4466", textAlign: "center" }}>{error}</div>
          <button onClick={() => router.push("/")} style={{
            padding: "12px 24px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)",
            background: "transparent", color: "white", fontSize: 14, cursor: "pointer",
          }}>
            Go Home
          </button>
        </div>
      )}

      {/* Error toast */}
      {error && lobbyState !== "error" && (
        <div style={{
          position: "fixed", bottom: 20, left: 20, right: 20,
          background: "#ff2244", borderRadius: 12, padding: "12px 16px",
          fontSize: 13, fontWeight: 600, textAlign: "center",
          zIndex: 100,
        }}>
          {error}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
