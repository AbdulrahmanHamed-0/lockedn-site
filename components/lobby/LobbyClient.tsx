//DEV NOTE : Friends 1v1 ... pregame lobby (should include "READY" , "MIC FOR TRASH TALK" , "SCREENS SIDE BY SIDE") 


"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, getPlayerId, type Room } from "@/lib/supabase";

interface Props { roomId: string; }

type LobbyState = "camera_prompt" | "connecting" | "waiting" | "lobby" | "countdown" | "error";

export default function LobbyClient({ roomId }: Props) {
  const router   = useRouter();
  const playerId = getPlayerId();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef     = useRef<MediaStream | null>(null);

  const [lobbyState, setLobbyState] = useState<LobbyState>("camera_prompt");
  const [isHost,     setIsHost]     = useState(false);
  const [myReady,    setMyReady]    = useState(false);
  const [oppReady,   setOppReady]   = useState(false);
  const [countdown,  setCountdown]  = useState(3);
  const [copied,     setCopied]     = useState(false);
  const [error,      setError]      = useState("");
  const [lobbyTimer, setLobbyTimer] = useState(30);
  const [cameraErr,  setCameraErr]  = useState("");

  const inviteUrl = typeof window !== "undefined"
    ? `${window.location.origin}/room/${roomId}` : "";

  // ── Step 1: Ask for camera permission explicitly ───────────────
  const requestCamera = useCallback(async () => {
    setCameraErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 }, height: { ideal: 480 },
          frameRate: { ideal: 15 }, facingMode: "user",
        },
        audio: false,
      });
      streamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play().catch(() => {});
      }
      // Camera granted → proceed to connect
      setLobbyState("connecting");
      initRoom();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera denied";
      if (msg.includes("denied") || msg.includes("Permission")) {
        setCameraErr("Camera permission was denied. Please allow camera access and try again.");
      } else {
        setCameraErr("Could not access camera: " + msg);
      }
    }
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Attach stream to video once ref is ready
  useEffect(() => {
    if (localVideoRef.current && streamRef.current) {
      localVideoRef.current.srcObject = streamRef.current;
      localVideoRef.current.play().catch(() => {});
    }
  });

  // ── Step 2: Create or join room ────────────────────────────────
  const initRoom = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("rooms").select("*").eq("id", roomId).single();

    if (err || !data) {
      // Room doesn't exist → create (host)
      const { error: createErr } = await supabase.from("rooms").insert({
        id: roomId, host_id: playerId, status: "waiting",
      });
      if (createErr) { setError("Failed to create room: " + createErr.message); setLobbyState("error"); return; }
      setIsHost(true);
      setLobbyState("waiting");
    } else {
      const room = data as Room;
      if (room.status === "finished") { setError("This match is already over."); setLobbyState("error"); return; }
      if (room.host_id === playerId) {
        // Host rejoining
        setIsHost(true);
        setLobbyState(room.guest_id ? "lobby" : "waiting");
        if (room.guest_id) {
          setMyReady(room.host_ready);
          setOppReady(room.guest_ready);
        }
      } else if (!room.guest_id || room.guest_id === playerId) {
        // Guest joining
        const { error: joinErr } = await supabase.from("rooms")
          .update({ guest_id: playerId, status: "ready" }).eq("id", roomId);
        if (joinErr) { setError("Failed to join: " + joinErr.message); setLobbyState("error"); return; }
        setIsHost(false);
        setMyReady(room.guest_ready);
        setOppReady(room.host_ready);
        setLobbyState("lobby");
      } else {
        setError("This room is full."); setLobbyState("error");
      }
    }
  }, [roomId, playerId]);

  // ── Realtime subscription ──────────────────────────────────────
  useEffect(() => {
    if (lobbyState === "camera_prompt") return;

    const channel = supabase
      .channel(`room:${roomId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public",
        table: "rooms", filter: `id=eq.${roomId}`,
      }, (payload) => {
        const updated = payload.new as Room;

        if (updated.guest_id && updated.status === "ready" && lobbyState === "waiting") {
          setLobbyState("lobby");
        }

        if (isHost) {
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
          router.push(`/battle/${roomId}`);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [lobbyState, roomId, isHost, router]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lobby trash talk timer ─────────────────────────────────────
  useEffect(() => {
    if (lobbyState !== "lobby" || lobbyTimer <= 0) return;
    const t = setTimeout(() => setLobbyTimer(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [lobbyState, lobbyTimer]);

  // ── Ready up ───────────────────────────────────────────────────
  async function handleReady() {
    if (myReady) return;
    setMyReady(true);
    const field = isHost ? "host_ready" : "guest_ready";
    await supabase.from("rooms").update({ [field]: true }).eq("id", roomId);
    const { data } = await supabase.from("rooms").select("*").eq("id", roomId).single();
    if (data?.host_ready && data?.guest_ready) {
      await supabase.from("rooms").update({ status: "countdown" }).eq("id", roomId);
    }
  }

  // ── Countdown ──────────────────────────────────────────────────
  function runCountdown() {
    let n = 3;
    setCountdown(n);
    const tick = setInterval(async () => {
      n--; setCountdown(n);
      if (n <= 0) {
        clearInterval(tick);
        if (isHost) {
          await supabase.from("rooms")
            .update({ status: "battle", started_at: new Date().toISOString() })
            .eq("id", roomId);
        }
        router.push(`/battle/${roomId}`);
      }
    }, 1000);
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  // ── RENDER ─────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0, background: "#060606",
      fontFamily: "'DM Mono','Courier New',monospace", color: "white",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>

      {/* Header */}
      <div style={{
        padding: "12px 20px", display: "flex",
        justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0,
      }}>
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: -1 }}>
          LOCKED'N<span style={{ color: "#00ff88" }}>.</span>
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

      {/* ══════════════════════════════════════
          CAMERA PERMISSION SCREEN
      ══════════════════════════════════════ */}
      {lobbyState === "camera_prompt" && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: 32, gap: 24, textAlign: "center",
        }}>
          <div style={{ fontSize: 56 }}>📷</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>
              Camera Access Required
            </div>
            <div style={{ fontSize: 13, opacity: 0.5, lineHeight: 1.7, maxWidth: 280 }}>
              Both players need their camera on so you can see each other during the trash talk lobby.
            </div>
          </div>

          {cameraErr && (
            <div style={{
              padding: "12px 16px", borderRadius: 12, fontSize: 12,
              background: "rgba(255,34,68,0.1)", border: "1px solid rgba(255,34,68,0.3)",
              color: "#ff4466", maxWidth: 320, lineHeight: 1.6,
            }}>
              {cameraErr}
              <div style={{ marginTop: 8, opacity: 0.7, fontSize: 11 }}>
                Tip: Check your browser settings and make sure camera is allowed for this site.
              </div>
            </div>
          )}

          <button onClick={requestCamera} style={{
            padding: "16px 40px", borderRadius: 14, border: 0,
            background: "linear-gradient(135deg, #00ff88, #00ccff)",
            color: "#000", fontSize: 16, fontWeight: 900,
            cursor: "pointer", letterSpacing: 0.5,
          }}>
            {cameraErr ? "Try Again" : "Allow Camera & Continue"}
          </button>

          <div style={{ fontSize: 11, opacity: 0.3 }}>
            Camera frames stay on your device — nothing is uploaded
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          CONNECTING
      ══════════════════════════════════════ */}
      {lobbyState === "connecting" && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00ff88" }} />
          <span style={{ opacity: 0.5, fontSize: 14 }}>Setting up room...</span>
        </div>
      )}

      {/* ══════════════════════════════════════
          WAITING (host, no guest yet)
      ══════════════════════════════════════ */}
      {lobbyState === "waiting" && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", padding: 24, gap: 20,
        }}>
          {/* My camera preview */}
          <div style={{
            width: "100%", maxWidth: 340, aspectRatio: "4/3",
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

          {/* Invite */}
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
              {copied ? "✓ COPIED!" : "COPY INVITE LINK"}
            </button>
          </div>

          <div style={{ opacity: 0.35, fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", opacity: 0.6 }} />
            Waiting for opponent...
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          LOBBY — top/bottom camera split
      ══════════════════════════════════════ */}
      {lobbyState === "lobby" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Top half — OPPONENT */}
          <div style={{
            flex: 1, position: "relative", background: "#0d0d0d",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            borderBottom: "2px solid rgba(255,255,255,0.06)",
          }}>
            {/* Opponent camera placeholder — WebRTC comes later */}
            <div style={{ fontSize: 48, marginBottom: 10 }}>👤</div>
            <div style={{ fontSize: 12, opacity: 0.4, letterSpacing: 1 }}>OPPONENT</div>
            <div style={{
              marginTop: 8, fontSize: 11, padding: "4px 14px", borderRadius: 20,
              background: oppReady ? "rgba(0,255,136,0.15)" : "rgba(255,255,255,0.05)",
              color: oppReady ? "#00ff88" : "rgba(255,255,255,0.3)",
              border: `1px solid ${oppReady ? "rgba(0,255,136,0.3)" : "rgba(255,255,255,0.08)"}`,
              fontWeight: 700,
            }}>
              {oppReady ? "✓ READY" : "not ready"}
            </div>

            {/* Opp name tag */}
            <div style={{
              position: "absolute", top: 10, left: 12,
              fontSize: 11, opacity: 0.3, letterSpacing: 1,
            }}>OPP 1</div>
          </div>

          {/* Bottom half — YOU */}
          <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
            <video ref={localVideoRef} playsInline muted autoPlay style={{
              width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)",
            }} />

            {/* Gradient overlay for bottom controls */}
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.85) 100%)",
            }} />

            {/* Name + ready tag */}
            <div style={{
              position: "absolute", top: 10, left: 12,
              fontSize: 11, fontWeight: 700, letterSpacing: 1,
            }}>YOU</div>
            <div style={{
              position: "absolute", top: 10, right: 12,
              fontSize: 11, padding: "3px 10px", borderRadius: 20, fontWeight: 700,
              background: myReady ? "rgba(0,255,136,0.2)" : "rgba(255,255,255,0.08)",
              color: myReady ? "#00ff88" : "rgba(255,255,255,0.4)",
              border: `1px solid ${myReady ? "rgba(0,255,136,0.3)" : "rgba(255,255,255,0.1)"}`,
            }}>
              {myReady ? "✓ READY" : "not ready"}
            </div>

            {/* Bottom controls */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              padding: "12px 16px 20px",
            }}>
              {/* Trash talk timer */}
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

              {/* Ready button */}
              <button
                onClick={handleReady}
                disabled={myReady}
                style={{
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
                  ? oppReady ? "BOTH READY — STARTING..." : "✓ READY — waiting for opponent"
                  : "I'M READY 🔥"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          COUNTDOWN
      ══════════════════════════════════════ */}
      {lobbyState === "countdown" && (
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16,
          background: "rgba(0,0,0,0.96)",
        }}>
          <div style={{ fontSize: 13, letterSpacing: 4, opacity: 0.5, fontWeight: 700 }}>GET READY</div>
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

      {/* ══════════════════════════════════════
          ERROR
      ══════════════════════════════════════ */}
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
    </div>
  );
}
