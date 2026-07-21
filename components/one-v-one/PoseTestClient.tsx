"use client";

import { useEffect, useRef, useState } from "react";
import type { PoseLandmarker as PoseLandmarkerType } from "@mediapipe/tasks-vision";

type Status = "idle" | "loading" | "running" | "error";
type PushupPhase = "no_plank" | "top" | "descending" | "bottom" | "ascending";

const MODEL_PATH = "/models/pose_landmarker_lite.task";
const WASM_PATH  = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const DETECTION_INTERVAL_MS = 66;

// ── Elbow rep thresholds ───────────────────────────────────────────
const TOP_ELBOW_ANGLE    = 150;
const BOTTOM_ELBOW_ANGLE = 95;
const MIN_REP_MS         = 700;

// ── Plank position validation ──────────────────────────────────────
//
// MediaPipe Y coords: 0 = top of frame, 1 = bottom of frame.
// When lying in a pushup (horizontal), shoulder/hip/ankle are ALL
// at similar Y values (e.g. 0.3–0.6). When standing, they stack
// vertically (shoulder ~0.1, hip ~0.5, ankle ~0.9).
//
// CHECK 1 — Body is horizontal:
//   The vertical span from shoulder to ankle must be SMALL.
//   (shoulder_y − ankle_y) when horizontal ≈ 0 (both at same height)
//   We use: |shoulder.y − ankle.y| / frame_height < HORIZONTAL_MAX
//   In normalised coords frame_height = 1, so just |shoulder.y − ankle.y|.
const HORIZONTAL_MAX = 0.25; // body must be within 25% of frame height vertically

// CHECK 2 — Hips are in line (not sagging or piked):
//   Hip Y must be within a band of shoulder Y.
//   Too high (piked) or too low (sagging/knees) both fail.
const HIP_BAND = 0.15;  // hip.y must be within ±15% of shoulder.y

// CHECK 3 — Body straightness angle (shoulder-hip-ankle):
const BODY_STRAIGHT_MIN = 155;

// EXIT — re-lock if person clearly gets up:
//   Ankle drops much lower than shoulder in the frame (vertical again).
const STAND_UP_VERTICAL = 0.45;

// Visibility floor
const VIS_MIN = 0.45;

// MediaPipe landmark indices
const LM = {
  LEFT_SHOULDER:  11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW:     13, RIGHT_ELBOW:    14,
  LEFT_WRIST:     15, RIGHT_WRIST:    16,
  LEFT_HIP:       23, RIGHT_HIP:      24,
  LEFT_KNEE:      25, RIGHT_KNEE:     26,
  LEFT_ANKLE:     27, RIGHT_ANKLE:    28,
};

type Landmark = { x: number; y: number; z: number; visibility?: number };

function vis(lm: Landmark) { return lm.visibility ?? 1; }

function angleDeg(a: Landmark, b: Landmark, c: Landmark) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.sqrt(ab.x ** 2 + ab.y ** 2) * Math.sqrt(cb.x ** 2 + cb.y ** 2);
  if (mag === 0) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

function getBestSide(lms: Landmark[]) {
  const pick = (side: "L" | "R") => {
    const s = side === "L" ? lms[LM.LEFT_SHOULDER]  : lms[LM.RIGHT_SHOULDER];
    const e = side === "L" ? lms[LM.LEFT_ELBOW]     : lms[LM.RIGHT_ELBOW];
    const w = side === "L" ? lms[LM.LEFT_WRIST]     : lms[LM.RIGHT_WRIST];
    const h = side === "L" ? lms[LM.LEFT_HIP]       : lms[LM.RIGHT_HIP];
    const k = side === "L" ? lms[LM.LEFT_KNEE]      : lms[LM.RIGHT_KNEE];
    const a = side === "L" ? lms[LM.LEFT_ANKLE]     : lms[LM.RIGHT_ANKLE];
    return { s, e, w, h, k, a, score: vis(s)+vis(e)+vis(w)+vis(h)+vis(k)+vis(a) };
  };
  const L = pick("L"), R = pick("R");
  return L.score >= R.score ? L : R;
}

// ── The real plank check ───────────────────────────────────────────
// Returns { ok, reason, checks } where checks are individual pass/fail
// for displaying to the user exactly what's wrong.
function checkPlankPosition(lms: Landmark[]): {
  ok: boolean;
  reason: string;
  checks: { label: string; pass: boolean; value: string }[];
} {
  const { s, h, a, score } = getBestSide(lms);

  const checks: { label: string; pass: boolean; value: string }[] = [];

  if (score / 6 < VIS_MIN) {
    return { ok: false, reason: "Body not fully visible", checks: [] };
  }

  // CHECK 1: Is body horizontal? (shoulder and ankle at similar Y)
  const verticalSpan = Math.abs(s.y - a.y);
  const isHorizontal = verticalSpan < HORIZONTAL_MAX;
  checks.push({
    label: "Body horizontal",
    pass: isHorizontal,
    value: `${Math.round(verticalSpan * 100)}% (need <${HORIZONTAL_MAX * 100}%)`,
  });

  // CHECK 2: Are hips in line with shoulders? (not sagging or piked)
  // In a proper plank, hip.y ≈ shoulder.y (both horizontal).
  // Sagging hips: hip.y > shoulder.y + HIP_BAND (hips lower than shoulders)
  // Piked hips: hip.y < shoulder.y - HIP_BAND (hips higher than shoulders — not really possible in pushup but catches kneeling)
  const hipOffset = h.y - s.y; // positive = hip is below shoulder in frame
  const hipsInLine = Math.abs(hipOffset) < HIP_BAND;
  const hipStatus = hipOffset > HIP_BAND ? "hips too low/sagging" :
                    hipOffset < -HIP_BAND ? "hips too high/piked" : "good";
  checks.push({
    label: "Hips in line",
    pass: hipsInLine,
    value: hipStatus,
  });

  // CHECK 3: Body straightness angle
  const bodyAngle = angleDeg(s, h, a);
  const isBodyStraight = bodyAngle >= BODY_STRAIGHT_MIN;
  checks.push({
    label: "Body straight",
    pass: isBodyStraight,
    value: `${Math.round(bodyAngle)}° (need ${BODY_STRAIGHT_MIN}°+)`,
  });

  const allPass = isHorizontal && hipsInLine && isBodyStraight;
  const failing = checks.filter(c => !c.pass);
  const reason = failing.length > 0 ? failing[0].label + " — " + failing[0].value : "";

  return { ok: allPass, reason, checks };
}

// ── Is the person clearly upright/standing? (for re-locking) ──────
function isStandingUp(lms: Landmark[]): boolean {
  const { s, a } = getBestSide(lms);
  // When standing, ankle is much lower in frame than shoulder
  return (a.y - s.y) > STAND_UP_VERTICAL;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function PoseTestClient() {
  const videoRef      = useRef<HTMLVideoElement | null>(null);
  const canvasRef     = useRef<HTMLCanvasElement | null>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarkerType | null>(null);
  const rafRef        = useRef<number | null>(null);

  const runningRef    = useRef(false);
  const lastDetectRef = useRef(0);
  const fpsCntRef     = useRef(0);
  const lastFpsRef    = useRef(performance.now());

  const phaseRef    = useRef<PushupPhase>("no_plank");
  const unlockedRef = useRef(false);
  const repCountRef = useRef(0);
  const lastRepRef  = useRef(0);

  const [status,     setStatus]     = useState<Status>("idle");
  const [message,    setMessage]    = useState("Click Start to begin.");
  const [fps,        setFps]        = useState(0);
  const [landmarks,  setLandmarks]  = useState(0);
  const [repCount,   setRepCount]   = useState(0);
  const [phase,      setPhase]      = useState<PushupPhase>("no_plank");
  const [feedback,   setFeedback]   = useState("");
  const [elbowAngle, setElbowAngle] = useState(0);
  const [unlocked,   setUnlocked]   = useState(false);
  const [plankChecks, setPlankChecks] = useState<{ label: string; pass: boolean; value: string }[]>([]);

  // ── MediaPipe ─────────────────────────────────────────────────────
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
    try   { return await PoseLandmarker.createFromOptions(vision, opts); }
    catch { return await PoseLandmarker.createFromOptions(vision,
              { ...opts, baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" as const } }); }
  }

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
      phaseRef.current = "no_plank"; unlockedRef.current = false;
      repCountRef.current = 0; lastRepRef.current = 0;
      setRepCount(0); setPhase("no_plank"); setFeedback(""); setUnlocked(false);
      runningRef.current = true;
      setStatus("running");
      setMessage("Get into pushup position sideways to camera.");
      loop();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed to start.");
    }
  }

  function stop() {
    runningRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    landmarkerRef.current?.close();
    streamRef.current = null; landmarkerRef.current = null;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setStatus("idle"); setFps(0); setLandmarks(0);
    setPhase("no_plank"); setFeedback(""); setUnlocked(false); setMessage("Stopped.");
  }

  function resetCounter() {
    phaseRef.current = "no_plank"; unlockedRef.current = false;
    repCountRef.current = 0; lastRepRef.current = 0;
    setRepCount(0); setPhase("no_plank"); setFeedback(""); setUnlocked(false);
  }

  // ── Core processing ───────────────────────────────────────────────
  function processPose(lms: Landmark[]) {
    const side = getBestSide(lms);
    const eAngle = angleDeg(side.s, side.e, side.w);
    setElbowAngle(Math.round(eAngle));

    // ── EXIT: clearly stood up → re-lock ─────────────────────────
    if (isStandingUp(lms)) {
      if (unlockedRef.current) {
        unlockedRef.current = false; setUnlocked(false);
        phaseRef.current = "no_plank"; setPhase("no_plank");
      }
      setFeedback("⚠️ Get into pushup position");
      setPlankChecks([]);
      return;
    }

    // ── ENTRY gate: check all 3 conditions ───────────────────────
    if (!unlockedRef.current) {
      const result = checkPlankPosition(lms);
      setPlankChecks(result.checks);
      if (result.ok) {
        unlockedRef.current = true; setUnlocked(true);
        phaseRef.current = "top"; setPhase("top");
        setFeedback("✅ Position locked — go!");
      } else {
        setFeedback("Fix position: " + result.reason);
      }
      return;
    }

    // ── Elbow state machine (runs freely once unlocked) ──────────
    setFeedback("");
    const now = performance.now();

    switch (phaseRef.current) {
      case "no_plank":
        phaseRef.current = "top"; setPhase("top");
        break;
      case "top":
        if (eAngle < TOP_ELBOW_ANGLE - 15) { phaseRef.current = "descending"; setPhase("descending"); }
        break;
      case "descending":
        if (eAngle <= BOTTOM_ELBOW_ANGLE) { phaseRef.current = "bottom"; setPhase("bottom"); }
        else if (eAngle >= TOP_ELBOW_ANGLE) {
          phaseRef.current = "top"; setPhase("top");
          setFeedback("⚠️ Go lower!");
        }
        break;
      case "bottom":
        if (eAngle > BOTTOM_ELBOW_ANGLE + 10) { phaseRef.current = "ascending"; setPhase("ascending"); }
        break;
      case "ascending":
        if (eAngle >= TOP_ELBOW_ANGLE) {
          if (now - lastRepRef.current >= MIN_REP_MS) {
            repCountRef.current++; lastRepRef.current = now;
            setRepCount(repCountRef.current);
          }
          phaseRef.current = "top"; setPhase("top");
        } else if (eAngle <= BOTTOM_ELBOW_ANGLE) {
          phaseRef.current = "bottom"; setPhase("bottom");
        }
        break;
    }
  }

  // ── Draw skeleton ─────────────────────────────────────────────────
  function drawPose(lms: Landmark[], currentPhase: PushupPhase, isUnlocked: boolean) {
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

    // RED when position is wrong, colour-coded by phase when correct
    const phaseColors: Record<PushupPhase, string> = {
      no_plank: "#ff2244",  // red = wrong position
      top:      "#00ff88",
      descending:"#ffcc00",
      bottom:   "#ff6644",
      ascending: "#44aaff",
    };
    const color = isUnlocked ? phaseColors[currentPhase] : "#ff2244";
    const dotColor = isUnlocked ? "#ffffff" : "#ff6666";

    ctx.lineWidth   = 5;
    ctx.strokeStyle = color;
    ctx.fillStyle   = dotColor;

    for (const [startIdx, endIdx] of connections) {
      const a = lms[startIdx], b = lms[endIdx];
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

  // ── rAF loop ──────────────────────────────────────────────────────
  function loop() {
    const video = videoRef.current, canvas = canvasRef.current, detector = landmarkerRef.current;
    if (!runningRef.current || !video || !canvas || !detector) return;

    if (video.videoWidth > 0 && video.videoHeight > 0) {
      if (canvas.width  !== video.videoWidth)  canvas.width  = video.videoWidth;
      if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

      const now = performance.now();
      if (now - lastDetectRef.current >= DETECTION_INTERVAL_MS) {
        lastDetectRef.current = now;
        const result = detector.detectForVideo(video, now);
        const lms = (result.landmarks?.[0] ?? []) as Landmark[];
        setLandmarks(lms.length);
        drawPose(lms, phaseRef.current, unlockedRef.current);
        if (lms.length > 0) processPose(lms);
        else setFeedback("⚠️ No pose detected");

        fpsCntRef.current++;
        const elapsed = now - lastFpsRef.current;
        if (elapsed >= 1000) {
          setFps(Math.round((fpsCntRef.current * 1000) / elapsed));
          fpsCntRef.current = 0; lastFpsRef.current = now;
        }
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const phaseLabel: Record<PushupPhase, string> = {
    no_plank:   "Fix your position ✗",
    top:        "TOP — go down!",
    descending: "Going down...",
    bottom:     "BOTTOM — push up!",
    ascending:  "Pushing up...",
  };
  const phaseColor: Record<PushupPhase, string> = {
    no_plank:  "#ff2244",
    top:       "#00ff88",
    descending:"#ffcc00",
    bottom:    "#ff6644",
    ascending: "#44aaff",
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
          <p style={{ margin: "4px 0 0", opacity: 0.5, fontSize: 13 }}>Phase 0 · Pushup Counter · Side view</p>
        </div>

        {/* Rep counter */}
        <div style={{
          textAlign: "center", padding: "20px 0 12px", borderRadius: 18,
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${unlocked ? "rgba(0,255,136,0.2)" : "rgba(255,34,68,0.3)"}`,
          marginBottom: 14, transition: "border-color 0.3s",
        }}>
          <div style={{
            fontSize: 96, fontWeight: 900, lineHeight: 1, letterSpacing: -4,
            color: repCount > 0 ? "#00ff88" : "rgba(255,255,255,0.12)",
            transition: "color 0.2s",
          }}>{repCount}</div>
          <div style={{ fontSize: 13, opacity: 0.5, marginTop: 4 }}>REPS</div>

          <div style={{
            marginTop: 12, display: "inline-block", padding: "6px 16px", borderRadius: 30,
            fontSize: 13, fontWeight: 700, background: "rgba(0,0,0,0.5)",
            border: `1px solid ${phaseColor[phase]}44`, color: phaseColor[phase],
          }}>
            {phaseLabel[phase]}
          </div>

          {feedback && (
            <div style={{
              marginTop: 8, fontSize: 12, fontWeight: 600,
              color: feedback.startsWith("✅") ? "#00ff88" : "#ff4466",
            }}>{feedback}</div>
          )}
        </div>

        {/* Status indicator */}
        {status === "running" && (
          <div style={{ marginBottom: 14 }}>

            {/* Lock status */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: 12, marginBottom: 10,
              background: unlocked ? "rgba(0,255,136,0.08)" : "rgba(255,34,68,0.08)",
              border: `1px solid ${unlocked ? "rgba(0,255,136,0.3)" : "rgba(255,34,68,0.3)"}`,
              transition: "all 0.3s",
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                background: unlocked ? "#00ff88" : "#ff2244",
                boxShadow: unlocked ? "0 0 8px #00ff88" : "0 0 8px #ff2244",
              }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: unlocked ? "#00ff88" : "#ff2244" }}>
                {unlocked ? "POSITION VALID — reps counting" : "INVALID POSITION — fix to start"}
              </div>
            </div>

            {/* Position checklist — shown while waiting */}
            {!unlocked && plankChecks.length > 0 && (
              <div style={{
                padding: "10px 14px", borderRadius: 12, marginBottom: 10,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              }}>
                {plankChecks.map((c, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "4px 0", fontSize: 12,
                    borderBottom: i < plankChecks.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  }}>
                    <span style={{ fontSize: 14 }}>{c.pass ? "✅" : "❌"}</span>
                    <span style={{ color: c.pass ? "#00ff88" : "#ff4466", fontWeight: 600, minWidth: 110 }}>
                      {c.label}
                    </span>
                    <span style={{ opacity: 0.5, fontSize: 11 }}>{c.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Elbow angle meter — shown while active */}
            {unlocked && (
              <AngleMeter
                label="Elbow angle"
                angle={elbowAngle}
                min={60} max={180}
                good={elbowAngle >= TOP_ELBOW_ANGLE || elbowAngle <= BOTTOM_ELBOW_ANGLE}
              />
            )}
          </div>
        )}

        {/* Video */}
        <div style={{
          position: "relative", width: "100%", aspectRatio: "4 / 3",
          background: "#111", borderRadius: 16, overflow: "hidden",
          border: `1px solid ${unlocked ? "rgba(0,255,136,0.15)" : "rgba(255,34,68,0.2)"}`,
          marginBottom: 14, transition: "border-color 0.3s",
        }}>
          <video ref={videoRef} playsInline muted autoPlay style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", transform: "scaleX(-1)",
          }} />
          <canvas ref={canvasRef} style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            transform: "scaleX(-1)",
          }} />

          {/* Corner badge */}
          <div style={{
            position: "absolute", top: 10, left: 10, padding: "8px 12px",
            borderRadius: 10, background: "rgba(0,0,0,0.75)",
            fontSize: 12, lineHeight: 1.6, backdropFilter: "blur(4px)",
          }}>
            <div style={{ opacity: 0.6 }}>FPS: {fps}</div>
            <div style={{ opacity: 0.6 }}>Landmarks: {landmarks}/33</div>
            <div style={{ color: unlocked ? "#00ff88" : "#ff2244", fontWeight: 700 }}>
              {unlocked ? "● ACTIVE" : "● INVALID"}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <button onClick={start} disabled={status === "loading" || status === "running"} style={{
            flex: 1, padding: "14px 0", borderRadius: 12, border: 0, fontWeight: 800, fontSize: 15,
            cursor: status === "loading" || status === "running" ? "not-allowed" : "pointer",
            background: status === "running" ? "rgba(0,255,136,0.15)" : "#00ff88",
            color: status === "running" ? "#00ff88" : "#000",
          }}>
            {status === "loading" ? "Loading..." : status === "running" ? "Running ✓" : "Start"}
          </button>
          <button onClick={stop} disabled={status !== "running" && status !== "loading"} style={{
            flex: 1, padding: "14px 0", borderRadius: 12, fontWeight: 800, fontSize: 15,
            border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer",
            background: "transparent", color: "white",
          }}>Stop</button>
          <button onClick={resetCounter} disabled={status !== "running"} style={{
            padding: "14px 18px", borderRadius: 12, cursor: "pointer", fontWeight: 700, fontSize: 13,
            border: "1px solid rgba(255,255,255,0.12)", background: "transparent",
            color: "rgba(255,255,255,0.5)",
          }}>Reset</button>
        </div>

        <p style={{ opacity: 0.5, fontSize: 13, margin: "0 0 14px" }}>{message}</p>

        {/* Guide */}
        <div style={{
          padding: 16, borderRadius: 14, background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)", fontSize: 13, lineHeight: 1.8,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: "#00ff88" }}>What the position check requires</div>
          <div style={{ opacity: 0.7 }}>
            🔴 <strong style={{ color: "white" }}>Red skeleton</strong> = wrong position, won&apos;t count<br />
            🟢 <strong style={{ color: "white" }}>Green skeleton</strong> = correct, reps counting<br /><br />
            The 3 checks that must ALL pass:<br />
            ✅ <strong style={{ color: "white" }}>Body horizontal</strong> — shoulder and ankle at same height in frame<br />
            ✅ <strong style={{ color: "white" }}>Hips in line</strong> — no sagging (knees down) or piking (butt up)<br />
            ✅ <strong style={{ color: "white" }}>Body straight</strong> — shoulder-hip-ankle angle ≥ {BODY_STRAIGHT_MIN}°<br /><br />
            <span style={{ opacity: 0.5 }}>Sitting, kneeling, piking, or facing camera all fail the check.</span>
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
        <span>{label}</span>
        <span style={{ color: good ? "#00ff88" : "white", fontWeight: 700 }}>{angle}°</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct * 100}%`, borderRadius: 3,
          background: good ? "#00ff88" : "#ffcc00", transition: "width 0.1s, background 0.2s",
        }} />
      </div>
    </div>
  );
}
