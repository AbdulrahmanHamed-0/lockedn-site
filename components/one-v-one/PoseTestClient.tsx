"use client";

import { useEffect, useRef, useState } from "react";
import type { PoseLandmarker as PoseLandmarkerType } from "@mediapipe/tasks-vision";

type Status = "idle" | "loading" | "running" | "error";
type PushupPhase = "no_plank" | "top" | "descending" | "bottom" | "ascending";

const MODEL_PATH = "/models/pose_landmarker_lite.task";
const WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

const DETECTION_INTERVAL_MS = 66; // ~15 FPS

// ── Pushup thresholds ──────────────────────────────────────────────
const TOP_ELBOW_ANGLE    = 150;   // arms extended at top
const BOTTOM_ELBOW_ANGLE = 95;    // arms bent at bottom
const BODY_STRAIGHT_MIN  = 145;   // shoulder-hip-ankle must be > this
const MIN_REP_MS         = 700;   // debounce between counted reps
const VIS_MIN            = 0.45;  // minimum landmark visibility

// ── Plank detection ────────────────────────────────────────────────
// In a plank (side view), shoulder and hip are at roughly the same
// Y coordinate (both near the top of the frame when lying down).
// When standing, shoulder Y is much smaller (higher on screen) than hip Y.
// We measure the VERTICAL distance between shoulder and hip, normalised
// by body height (shoulder-to-ankle distance).
// Ratio < PLANK_RATIO_MAX  → person is roughly horizontal → plank OK.
// We also check that the body isn't nearly vertical (standing).
const PLANK_V_RATIO_MAX = 0.30;  // shoulder-hip vertical gap / body height

// MediaPipe landmark indices
const LM = {
  LEFT_SHOULDER:  11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW:     13,
  RIGHT_ELBOW:    14,
  LEFT_WRIST:     15,
  RIGHT_WRIST:    16,
  LEFT_HIP:       23,
  RIGHT_HIP:      24,
  LEFT_KNEE:      25,
  RIGHT_KNEE:     26,
  LEFT_ANKLE:     27,
  RIGHT_ANKLE:    28,
};

type Landmark = { x: number; y: number; z: number; visibility?: number };

function vis(lm: Landmark): number {
  return lm.visibility ?? 1;
}

function angleDeg(a: Landmark, b: Landmark, c: Landmark): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag =
    Math.sqrt(ab.x ** 2 + ab.y ** 2) * Math.sqrt(cb.x ** 2 + cb.y ** 2);
  if (mag === 0) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

// ── Pick whichever side has better visibility ──────────────────────
function getBestSide(lms: Landmark[]): {
  shoulder: Landmark; elbow: Landmark; wrist: Landmark;
  hip: Landmark; knee: Landmark; ankle: Landmark;
  visScore: number;
} {
  const pick = (side: "L" | "R") => {
    const s = side === "L" ? lms[LM.LEFT_SHOULDER]  : lms[LM.RIGHT_SHOULDER];
    const e = side === "L" ? lms[LM.LEFT_ELBOW]     : lms[LM.RIGHT_ELBOW];
    const w = side === "L" ? lms[LM.LEFT_WRIST]     : lms[LM.RIGHT_WRIST];
    const h = side === "L" ? lms[LM.LEFT_HIP]       : lms[LM.RIGHT_HIP];
    const k = side === "L" ? lms[LM.LEFT_KNEE]      : lms[LM.RIGHT_KNEE];
    const a = side === "L" ? lms[LM.LEFT_ANKLE]     : lms[LM.RIGHT_ANKLE];
    const score = vis(s) + vis(e) + vis(w) + vis(h) + vis(k) + vis(a);
    return { shoulder: s, elbow: e, wrist: w, hip: h, knee: k, ankle: a, visScore: score };
  };
  const L = pick("L");
  const R = pick("R");
  return L.visScore >= R.visScore ? L : R;
}

// ── Plank check: is the person lying roughly horizontal? ───────────
// Uses the BEST side's shoulder and ankle to estimate body height,
// then checks that shoulder and hip are close vertically.
function isInPlankPosition(lms: Landmark[]): { ok: boolean; reason: string } {
  const { shoulder, hip, ankle, visScore } = getBestSide(lms);

  // Require at least shoulder + hip + ankle to be visible
  if (visScore / 6 < VIS_MIN) {
    return { ok: false, reason: "⚠️ Body not fully visible" };
  }

  // Body height in normalised coords (shoulder Y to ankle Y when standing).
  // Y increases downward in MediaPipe coords.
  const bodyHeight = Math.abs(ankle.y - shoulder.y);

  // If body height is tiny, something is off (maybe only torso in frame).
  if (bodyHeight < 0.1) {
    return { ok: false, reason: "⚠️ Move further back — full body needed" };
  }

  // Vertical gap between shoulder and hip, normalised by body height.
  // When standing: shoulder is HIGH (small Y), hip is LOWER (larger Y) → large ratio.
  // When in plank (side view): both are close in Y → small ratio.
  const vGap = Math.abs(hip.y - shoulder.y) / bodyHeight;

  if (vGap > PLANK_V_RATIO_MAX) {
    return { ok: false, reason: "⚠️ Get into plank position" };
  }

  return { ok: true, reason: "" };
}

// ─────────────────────────────────────────────────────────────────────────────

export default function PoseTestClient() {
  const videoRef    = useRef<HTMLVideoElement | null>(null);
  const canvasRef   = useRef<HTMLCanvasElement | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarkerType | null>(null);
  const rafRef      = useRef<number | null>(null);

  const runningRef      = useRef(false);
  const lastDetectRef   = useRef(0);
  const fpsCntRef       = useRef(0);
  const lastFpsRef      = useRef(performance.now());

  // State machine refs (avoid stale closures in rAF loop)
  const phaseRef        = useRef<PushupPhase>("no_plank");
  const repCountRef     = useRef(0);
  const lastRepRef      = useRef(0);

  const [status,      setStatus]      = useState<Status>("idle");
  const [message,     setMessage]     = useState("Click Start to begin.");
  const [fps,         setFps]         = useState(0);
  const [landmarks,   setLandmarks]   = useState(0);
  const [repCount,    setRepCount]    = useState(0);
  const [phase,       setPhase]       = useState<PushupPhase>("no_plank");
  const [feedback,    setFeedback]    = useState("");
  const [elbowAngle,  setElbowAngle]  = useState(0);
  const [bodyAngle,   setBodyAngle]   = useState(0);
  const [plankRatio,  setPlankRatio]  = useState(0); // for debug

  // ── MediaPipe setup ──────────────────────────────────────────────
  async function createLandmarker() {
    const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    const opts = {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" as const },
      runningMode: "VIDEO" as const,
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence:  0.5,
      minTrackingConfidence:      0.5,
      outputSegmentationMasks: false,
    };
    try {
      return await PoseLandmarker.createFromOptions(vision, opts);
    } catch {
      return await PoseLandmarker.createFromOptions(vision, {
        ...opts,
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" as const },
      });
    }
  }

  // ── Start ────────────────────────────────────────────────────────
  async function start() {
    try {
      setStatus("loading");
      setMessage("Requesting camera...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 },
                 frameRate: { ideal: 30, max: 30 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      setMessage("Loading pose model...");
      landmarkerRef.current = await createLandmarker();

      phaseRef.current    = "no_plank";
      repCountRef.current = 0;
      lastRepRef.current  = 0;
      setRepCount(0);
      setPhase("no_plank");
      setFeedback("");

      runningRef.current = true;
      setStatus("running");
      setMessage("Get into plank/pushup position sideways to camera.");
      loop();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed to start.");
    }
  }

  // ── Stop ─────────────────────────────────────────────────────────
  function stop() {
    runningRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    landmarkerRef.current?.close();
    streamRef.current  = null;
    landmarkerRef.current = null;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current)
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setStatus("idle"); setFps(0); setLandmarks(0);
    setPhase("no_plank"); setFeedback(""); setMessage("Stopped.");
  }

  function resetCounter() {
    phaseRef.current    = "no_plank";
    repCountRef.current = 0;
    lastRepRef.current  = 0;
    setRepCount(0); setPhase("no_plank"); setFeedback("");
  }

  // ── Main detection + state machine ──────────────────────────────
  function processPose(lms: Landmark[]) {
    // ── 1. Plank gate ─────────────────────────────────────────────
    const plankCheck = isInPlankPosition(lms);

    // Compute best-side angles regardless (for the meters)
    const side = getBestSide(lms);
    const eAngle = angleDeg(side.shoulder, side.elbow, side.wrist);
    const bAngle = angleDeg(side.shoulder, side.hip, side.ankle);

    // For the plank ratio display
    const bodyH = Math.abs(side.ankle.y - side.shoulder.y);
    const vGap  = bodyH > 0 ? Math.abs(side.hip.y - side.shoulder.y) / bodyH : 1;

    setElbowAngle(Math.round(eAngle));
    setBodyAngle(Math.round(bAngle));
    setPlankRatio(Math.round(vGap * 100));

    if (!plankCheck.ok) {
      // Exit any active phase back to "no_plank"
      if (phaseRef.current !== "no_plank") {
        phaseRef.current = "no_plank";
        setPhase("no_plank");
      }
      setFeedback(plankCheck.reason);
      return;
    }

    // ── 2. Body straight check ────────────────────────────────────
    const bodyIsStraight = bAngle >= BODY_STRAIGHT_MIN;
    if (!bodyIsStraight) {
      setFeedback("⚠️ Keep body straight — hips up!");
    } else {
      setFeedback("");
    }

    const now = performance.now();
    const prev = phaseRef.current;

    // ── 3. State machine ──────────────────────────────────────────
    switch (phaseRef.current) {
      case "no_plank":
        // Just entered plank — wait for TOP position first
        if (eAngle >= TOP_ELBOW_ANGLE) {
          phaseRef.current = "top";
          setPhase("top");
        }
        break;

      case "top":
        if (eAngle < TOP_ELBOW_ANGLE - 15) {
          phaseRef.current = "descending";
          setPhase("descending");
        }
        break;

      case "descending":
        if (eAngle <= BOTTOM_ELBOW_ANGLE) {
          if (bodyIsStraight) {
            phaseRef.current = "bottom";
            setPhase("bottom");
          } else {
            setFeedback("⚠️ Keep body straight — no-rep!");
          }
        }
        // If they come back up without reaching bottom → back to top
        if (eAngle >= TOP_ELBOW_ANGLE) {
          phaseRef.current = "top";
          setPhase("top");
        }
        break;

      case "bottom":
        if (eAngle > BOTTOM_ELBOW_ANGLE + 10) {
          phaseRef.current = "ascending";
          setPhase("ascending");
        }
        break;

      case "ascending":
        if (eAngle >= TOP_ELBOW_ANGLE) {
          if (now - lastRepRef.current >= MIN_REP_MS) {
            repCountRef.current += 1;
            lastRepRef.current = now;
            setRepCount(repCountRef.current);
          }
          phaseRef.current = "top";
          setPhase("top");
        }
        // If they drop again without finishing → back to descending
        if (eAngle <= BOTTOM_ELBOW_ANGLE) {
          phaseRef.current = "bottom";
          setPhase("bottom");
        }
        break;
    }
  }

  // ── Draw skeleton ────────────────────────────────────────────────
  function drawPose(lms: Landmark[], currentPhase: PushupPhase) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!lms.length) return;

    const connections = [
      [11,12],[11,13],[13,15],[12,14],[14,16],
      [11,23],[12,24],[23,24],
      [23,25],[25,27],[24,26],[26,28],
    ];

    const colors: Record<PushupPhase, string> = {
      no_plank:   "#555555",
      top:        "#00ff88",
      descending: "#ffcc00",
      bottom:     "#ff6644",
      ascending:  "#44aaff",
    };
    const color = colors[currentPhase];

    ctx.lineWidth = 5;
    ctx.strokeStyle = color;
    ctx.fillStyle   = "#ffffff";

    for (const [s, e] of connections) {
      const a = lms[s], b = lms[e];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
      ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
      ctx.stroke();
    }
    for (const pt of lms) {
      ctx.beginPath();
      ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── rAF loop ─────────────────────────────────────────────────────
  function loop() {
    const video    = videoRef.current;
    const canvas   = canvasRef.current;
    const detector = landmarkerRef.current;

    if (!runningRef.current || !video || !canvas || !detector) return;

    if (video.videoWidth > 0 && video.videoHeight > 0) {
      if (canvas.width !== video.videoWidth)   canvas.width  = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

      const now = performance.now();
      if (now - lastDetectRef.current >= DETECTION_INTERVAL_MS) {
        lastDetectRef.current = now;

        const result = detector.detectForVideo(video, now);
        const lms    = (result.landmarks?.[0] ?? []) as Landmark[];

        setLandmarks(lms.length);
        drawPose(lms, phaseRef.current);

        if (lms.length > 0) processPose(lms);
        else setFeedback("⚠️ No pose detected");

        fpsCntRef.current++;
        const elapsed = now - lastFpsRef.current;
        if (elapsed >= 1000) {
          setFps(Math.round((fpsCntRef.current * 1000) / elapsed));
          fpsCntRef.current = 0;
          lastFpsRef.current = now;
        }
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }

  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Labels / colours for UI ──────────────────────────────────────
  const phaseLabel: Record<PushupPhase, string> = {
    no_plank:   "Get into plank ↓",
    top:        "TOP — go down!",
    descending: "Going down...",
    bottom:     "BOTTOM — push up!",
    ascending:  "Pushing up...",
  };
  const phaseColor: Record<PushupPhase, string> = {
    no_plank:   "#666",
    top:        "#00ff88",
    descending: "#ffcc00",
    bottom:     "#ff6644",
    ascending:  "#44aaff",
  };

  // ─────────────────────────────────────────────────────────────────
  return (
    <main style={{
      minHeight: "100vh", background: "#080808", color: "white",
      padding: 20, fontFamily: "'DM Mono','Courier New',monospace",
    }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1, margin: 0 }}>
            LOCKED'N<span style={{ color: "#00ff88" }}>.</span>
          </h1>
          <p style={{ margin: "4px 0 0", opacity: 0.5, fontSize: 13 }}>
            Phase 0 · Pushup Counter · Side view
          </p>
        </div>

        {/* Rep counter */}
        <div style={{
          textAlign: "center", padding: "20px 0 12px", borderRadius: 18,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)", marginBottom: 14,
        }}>
          <div style={{
            fontSize: 96, fontWeight: 900, lineHeight: 1, letterSpacing: -4,
            color: repCount > 0 ? "#00ff88" : "rgba(255,255,255,0.15)",
            transition: "color 0.2s",
          }}>
            {repCount}
          </div>
          <div style={{ fontSize: 13, opacity: 0.5, marginTop: 4 }}>REPS</div>

          {/* Phase pill */}
          <div style={{
            marginTop: 12, display: "inline-block",
            padding: "6px 16px", borderRadius: 30, fontSize: 13, fontWeight: 700,
            background: "rgba(0,0,0,0.5)",
            border: `1px solid ${phaseColor[phase]}44`,
            color: phaseColor[phase], letterSpacing: 0.5,
          }}>
            {phaseLabel[phase]}
          </div>

          {/* Feedback */}
          {feedback && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#ff6644", fontWeight: 600 }}>
              {feedback}
            </div>
          )}
        </div>

        {/* Angle meters */}
        {status === "running" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <AngleMeter label="Elbow" angle={elbowAngle} min={60} max={180}
              good={elbowAngle >= TOP_ELBOW_ANGLE || elbowAngle <= BOTTOM_ELBOW_ANGLE} />
            <AngleMeter label="Body" angle={bodyAngle} min={100} max={180}
              good={bodyAngle >= BODY_STRAIGHT_MIN} />
          </div>
        )}

        {/* Plank debug meter */}
        {status === "running" && (
          <div style={{
            marginBottom: 14, padding: "10px 12px", borderRadius: 12,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
              <span>Plank check (shoulder↔hip gap / body height)</span>
              <span style={{ color: plankRatio <= PLANK_V_RATIO_MAX * 100 ? "#00ff88" : "#ff6644", fontWeight: 700 }}>
                {plankRatio}% {plankRatio <= PLANK_V_RATIO_MAX * 100 ? "✓" : "✗"}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.min(100, plankRatio)}%`,
                borderRadius: 3,
                background: plankRatio <= 30 ? "#00ff88" : "#ff6644",
                transition: "width 0.15s, background 0.2s",
              }} />
            </div>
            <div style={{ fontSize: 11, opacity: 0.4, marginTop: 4 }}>
              Must be ≤ 30% to count reps. Currently: {plankRatio}%
            </div>
          </div>
        )}

        {/* Video */}
        <div style={{
          position: "relative", width: "100%", aspectRatio: "4 / 3",
          background: "#111", borderRadius: 16, overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.1)", marginBottom: 14,
        }}>
          <video ref={videoRef} playsInline muted autoPlay style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", transform: "scaleX(-1)",
          }} />
          <canvas ref={canvasRef} style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            transform: "scaleX(-1)",
          }} />
          <div style={{
            position: "absolute", top: 10, left: 10, padding: "8px 12px",
            borderRadius: 10, background: "rgba(0,0,0,0.7)",
            fontSize: 12, lineHeight: 1.6, backdropFilter: "blur(4px)",
          }}>
            <div style={{ opacity: 0.6 }}>Status: {status}</div>
            <div style={{ opacity: 0.6 }}>FPS: {fps}</div>
            <div style={{ opacity: 0.6 }}>Landmarks: {landmarks}/33</div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <button onClick={start}
            disabled={status === "loading" || status === "running"}
            style={{
              flex: 1, padding: "14px 0", borderRadius: 12, border: 0,
              cursor: status === "loading" || status === "running" ? "not-allowed" : "pointer",
              fontWeight: 800, fontSize: 15,
              background: status === "running" ? "rgba(0,255,136,0.15)" : "#00ff88",
              color: status === "running" ? "#00ff88" : "#000",
              transition: "all 0.2s",
            }}>
            {status === "loading" ? "Loading..." : status === "running" ? "Running ✓" : "Start"}
          </button>
          <button onClick={stop}
            disabled={status !== "running" && status !== "loading"}
            style={{
              flex: 1, padding: "14px 0", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer",
              fontWeight: 800, fontSize: 15, background: "transparent", color: "white",
            }}>Stop</button>
          <button onClick={resetCounter} disabled={status !== "running"}
            style={{
              padding: "14px 18px", borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer",
              fontWeight: 700, fontSize: 13, background: "transparent",
              color: "rgba(255,255,255,0.5)",
            }}>Reset</button>
        </div>

        <p style={{ opacity: 0.5, fontSize: 13, margin: "0 0 14px" }}>{message}</p>

        {/* Guide */}
        <div style={{
          padding: 16, borderRadius: 14, background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)", fontSize: 13, lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: "#00ff88" }}>How to use</div>
          <div style={{ opacity: 0.7 }}>
            📱 Place your phone on its side at roughly hip/waist height so your <strong>full body is visible from the side</strong>.<br />
            🤸 Get into pushup/plank position — the <strong>Plank check</strong> meter above must turn green before reps count.<br />
            ✅ Skeleton colour: <span style={{ color: "#00ff88" }}>green</span> = top,{" "}
            <span style={{ color: "#ffcc00" }}>yellow</span> = going down,{" "}
            <span style={{ color: "#ff6644" }}>red</span> = bottom,{" "}
            <span style={{ color: "#44aaff" }}>blue</span> = going up.<br />
            ⚠️ Standing and moving your arms will <strong>not</strong> count — plank gate blocks it.
          </div>
        </div>
      </div>
    </main>
  );
}

function AngleMeter({ label, angle, min = 60, max = 180, good }: {
  label: string; angle: number; min?: number; max?: number; good: boolean;
}) {
  const pct = Math.max(0, Math.min(1, (angle - min) / (max - min)));
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 12,
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6, opacity: 0.7 }}>
        <span>{label} angle</span>
        <span style={{ color: good ? "#00ff88" : "white", fontWeight: 700 }}>{angle}°</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct * 100}%`, borderRadius: 3,
          background: good ? "#00ff88" : "#ffcc00",
          transition: "width 0.1s, background 0.2s",
        }} />
      </div>
    </div>
  );
}
