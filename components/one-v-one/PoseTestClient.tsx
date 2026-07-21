"use client";

import { useEffect, useRef, useState } from "react";
import type { PoseLandmarker as PoseLandmarkerType } from "@mediapipe/tasks-vision";

type Status = "idle" | "loading" | "running" | "error";
type PushupPhase = "no_plank" | "top" | "descending" | "bottom" | "ascending";

const MODEL_PATH = "/models/pose_landmarker_lite.task";
const WASM_PATH  = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const DETECTION_INTERVAL_MS = 66;

// ── Rep thresholds ─────────────────────────────────────────────────
const TOP_ELBOW_ANGLE    = 150;
const BOTTOM_ELBOW_ANGLE = 95;
const MIN_REP_MS         = 700;

// ── Position validation thresholds ────────────────────────────────
// These are checked CONTINUOUSLY (not just at entry), so if you
// drop knees mid-set the counter pauses immediately.
//
// Body horizontal: |shoulder.y - ankle.y| < this (normalised 0-1)
const HORIZONTAL_MAX = 0.28;
// Hip in line with shoulder: |hip.y - shoulder.y| < this
const HIP_BAND = 0.14;
// Body straight angle (shoulder-hip-ankle)
const BODY_ANGLE_MIN = 150;
// Knee straight: knee angle must be > this to confirm legs are straight
// When kneeling, knee angle is ~90°. When lying straight, ~160-180°.
const KNEE_STRAIGHT_MIN = 140;
// Re-lock exit: ankle clearly below shoulder (standing up)
const STAND_UP_VERTICAL = 0.40;

const VIS_MIN = 0.40;

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
  const mag = Math.sqrt(ab.x**2 + ab.y**2) * Math.sqrt(cb.x**2 + cb.y**2);
  if (mag === 0) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

function getBestSide(lms: Landmark[]) {
  const pick = (side: "L" | "R") => {
    const s = side === "L" ? lms[LM.LEFT_SHOULDER] : lms[LM.RIGHT_SHOULDER];
    const e = side === "L" ? lms[LM.LEFT_ELBOW]    : lms[LM.RIGHT_ELBOW];
    const w = side === "L" ? lms[LM.LEFT_WRIST]    : lms[LM.RIGHT_WRIST];
    const h = side === "L" ? lms[LM.LEFT_HIP]      : lms[LM.RIGHT_HIP];
    const k = side === "L" ? lms[LM.LEFT_KNEE]     : lms[LM.RIGHT_KNEE];
    const a = side === "L" ? lms[LM.LEFT_ANKLE]    : lms[LM.RIGHT_ANKLE];
    return { s, e, w, h, k, a, score: vis(s)+vis(e)+vis(w)+vis(h)+vis(k)+vis(a) };
  };
  const L = pick("L"), R = pick("R");
  return L.score >= R.score ? L : R;
}

type CheckResult = { label: string; pass: boolean; value: string; hint: string };

// ── Continuous position check (called every frame) ─────────────────
function checkPosition(lms: Landmark[]): {
  ok: boolean;
  checks: CheckResult[];
  angles: {
    elbow: number; body: number; knee: number;
    hipOffset: number; verticalSpan: number;
  };
} {
  const { s, e, w, h, k, a, score } = getBestSide(lms);

  const elbowAngle   = Math.round(angleDeg(s, e, w));
  const bodyAngle    = Math.round(angleDeg(s, h, a));
  const kneeAngle    = Math.round(angleDeg(h, k, a));
  const verticalSpan = Math.round(Math.abs(s.y - a.y) * 100); // as %
  const hipOffsetRaw = (h.y - s.y);  // positive = hip below shoulder
  const hipOffsetPct = Math.round(hipOffsetRaw * 100);

  const angles = { elbow: elbowAngle, body: bodyAngle, knee: kneeAngle,
                   hipOffset: hipOffsetPct, verticalSpan };

  if (score / 6 < VIS_MIN) {
    return { ok: false, angles, checks: [
      { label: "Visibility", pass: false, value: "body not in frame", hint: "Move back so full body is visible" }
    ]};
  }

  const checks: CheckResult[] = [];

  // 1. Body horizontal
  const isHoriz = verticalSpan < HORIZONTAL_MAX * 100;
  checks.push({
    label: "Body horizontal",
    pass: isHoriz,
    value: `span: ${verticalSpan}%`,
    hint: isHoriz ? "✓" : `Need <${Math.round(HORIZONTAL_MAX*100)}% — lie flat`,
  });

  // 2. Hips in line (not sagging, not piked)
  const hipsOk = Math.abs(hipOffsetRaw) < HIP_BAND;
  const hipHint = hipOffsetRaw > HIP_BAND   ? "hips too low / sagging / knees down"
                : hipOffsetRaw < -HIP_BAND  ? "hips too high / piked"
                : "✓";
  checks.push({
    label: "Hips level",
    pass: hipsOk,
    value: `offset: ${hipOffsetPct > 0 ? "+" : ""}${hipOffsetPct}%`,
    hint: hipHint,
  });

  // 3. Legs straight (knee angle) — catches kneeling
  const kneesOk = kneeAngle >= KNEE_STRAIGHT_MIN;
  checks.push({
    label: "Legs straight",
    pass: kneesOk,
    value: `knee: ${kneeAngle}°`,
    hint: kneesOk ? "✓" : `Need >${KNEE_STRAIGHT_MIN}° — lift knees off floor`,
  });

  // 4. Body straight angle
  const bodyOk = bodyAngle >= BODY_ANGLE_MIN;
  checks.push({
    label: "Body straight",
    pass: bodyOk,
    value: `body: ${bodyAngle}°`,
    hint: bodyOk ? "✓" : `Need >${BODY_ANGLE_MIN}° — straighten core`,
  });

  const ok = isHoriz && hipsOk && kneesOk && bodyOk;
  return { ok, checks, angles };
}

function isStandingUp(lms: Landmark[]): boolean {
  const { s, a } = getBestSide(lms);
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
  // positionOk tracks real-time validity (not a one-time gate anymore)
  const positionOkRef = useRef(false);
  const repCountRef = useRef(0);
  const lastRepRef  = useRef(0);

  const [status,     setStatus]     = useState<Status>("idle");
  const [message,    setMessage]    = useState("Click Start to begin.");
  const [fps,        setFps]        = useState(0);
  const [landmarks,  setLandmarks]  = useState(0);
  const [repCount,   setRepCount]   = useState(0);
  const [phase,      setPhase]      = useState<PushupPhase>("no_plank");
  const [feedback,   setFeedback]   = useState("");
  const [positionOk, setPositionOk] = useState(false);
  const [checks,     setChecks]     = useState<CheckResult[]>([]);
  const [angles,     setAngles]     = useState({ elbow: 0, body: 0, knee: 0, hipOffset: 0, verticalSpan: 0 });

  async function createLandmarker() {
    const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    const opts = {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" as const },
      runningMode: "VIDEO" as const, numPoses: 1,
      minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5, outputSegmentationMasks: false,
    };
    try   { return await PoseLandmarker.createFromOptions(vision, opts); }
    catch { return await PoseLandmarker.createFromOptions(vision,
              { ...opts, baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" as const } }); }
  }

  async function start() {
    try {
      setStatus("loading"); setMessage("Requesting camera...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 },
                 frameRate: { ideal: 30, max: 30 }, facingMode: "user" }, audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream; await video.play();
      setMessage("Loading pose model...");
      landmarkerRef.current = await createLandmarker();
      phaseRef.current = "no_plank"; positionOkRef.current = false;
      repCountRef.current = 0; lastRepRef.current = 0;
      setRepCount(0); setPhase("no_plank"); setFeedback(""); setPositionOk(false);
      runningRef.current = true; setStatus("running");
      setMessage("Get into pushup position sideways.");
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
    setPhase("no_plank"); setFeedback(""); setPositionOk(false); setMessage("Stopped.");
  }

  function resetCounter() {
    phaseRef.current = "no_plank"; positionOkRef.current = false;
    repCountRef.current = 0; lastRepRef.current = 0;
    setRepCount(0); setPhase("no_plank"); setFeedback(""); setPositionOk(false);
  }

  function processPose(lms: Landmark[]) {
    // Always run checks every frame
    const result = checkPosition(lms);
    setAngles(result.angles);
    setChecks(result.checks);

    const wasOk = positionOkRef.current;
    const nowOk = result.ok;

    positionOkRef.current = nowOk;
    setPositionOk(nowOk);

    // Position just became invalid mid-set → pause and re-lock
    if (wasOk && !nowOk) {
      phaseRef.current = "no_plank";
      setPhase("no_plank");
    }

    if (!nowOk) {
      // Show which check is failing
      const failing = result.checks.find(c => !c.pass);
      setFeedback(failing ? `❌ ${failing.label}: ${failing.hint}` : "❌ Fix position");
      return;
    }

    // Position is valid — run elbow state machine
    setFeedback("");
    const eAngle = result.angles.elbow;
    const now = performance.now();

    switch (phaseRef.current) {
      case "no_plank":
        // Just became valid — wait for arms to be extended
        if (eAngle >= TOP_ELBOW_ANGLE) {
          phaseRef.current = "top"; setPhase("top");
        } else {
          setFeedback("Extend arms fully to start");
        }
        break;

      case "top":
        if (eAngle < TOP_ELBOW_ANGLE - 15) {
          phaseRef.current = "descending"; setPhase("descending");
        }
        break;

      case "descending":
        if (eAngle <= BOTTOM_ELBOW_ANGLE) {
          phaseRef.current = "bottom"; setPhase("bottom");
        } else if (eAngle >= TOP_ELBOW_ANGLE) {
          phaseRef.current = "top"; setPhase("top");
          setFeedback("⚠️ Go lower to count!");
        }
        break;

      case "bottom":
        if (eAngle > BOTTOM_ELBOW_ANGLE + 10) {
          phaseRef.current = "ascending"; setPhase("ascending");
        }
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

  function drawPose(lms: Landmark[], currentPhase: PushupPhase, isOk: boolean) {
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

    const phaseColors: Record<PushupPhase, string> = {
      no_plank:   "#ff2244",
      top:        "#00ff88",
      descending: "#ffcc00",
      bottom:     "#ff6644",
      ascending:  "#44aaff",
    };

    const color    = isOk ? phaseColors[currentPhase] : "#ff2244";
    const dotColor = isOk ? "#ffffff" : "#ff6666";

    ctx.lineWidth = 5; ctx.strokeStyle = color; ctx.fillStyle = dotColor;

    for (const [si, ei] of connections) {
      const a = lms[si], b = lms[ei];
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
        drawPose(lms, phaseRef.current, positionOkRef.current);
        if (lms.length > 0) processPose(lms);
        else { setFeedback("⚠️ No pose detected"); setPositionOk(false); }

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
    no_plank:   "Fix position ✗",
    top:        "TOP — go down!",
    descending: "Going down...",
    bottom:     "BOTTOM — push up!",
    ascending:  "Pushing up...",
  };
  const phaseColor: Record<PushupPhase, string> = {
    no_plank:   "#ff2244",
    top:        "#00ff88",
    descending: "#ffcc00",
    bottom:     "#ff6644",
    ascending:  "#44aaff",
  };

  return (
    <main style={{
      minHeight: "100vh", background: "#080808", color: "white",
      padding: 16, fontFamily: "'DM Mono','Courier New',monospace",
    }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 12 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -1, margin: 0 }}>
            LOCKED'N<span style={{ color: "#00ff88" }}>.</span>
          </h1>
          <p style={{ margin: "2px 0 0", opacity: 0.4, fontSize: 12 }}>Phase 0 · Pushup Counter · Side view</p>
        </div>

        {/* Rep counter */}
        <div style={{
          textAlign: "center", padding: "16px 0 10px", borderRadius: 16,
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${positionOk ? "rgba(0,255,136,0.2)" : "rgba(255,34,68,0.3)"}`,
          marginBottom: 12, transition: "border-color 0.3s",
        }}>
          <div style={{
            fontSize: 88, fontWeight: 900, lineHeight: 1, letterSpacing: -4,
            color: repCount > 0 ? "#00ff88" : "rgba(255,255,255,0.12)",
          }}>{repCount}</div>
          <div style={{ fontSize: 12, opacity: 0.4, marginTop: 2 }}>REPS</div>
          <div style={{
            marginTop: 10, display: "inline-block", padding: "5px 14px", borderRadius: 30,
            fontSize: 12, fontWeight: 700, background: "rgba(0,0,0,0.5)",
            border: `1px solid ${phaseColor[phase]}44`, color: phaseColor[phase],
          }}>
            {phaseLabel[phase]}
          </div>
          {feedback && (
            <div style={{
              marginTop: 6, fontSize: 12, fontWeight: 600, padding: "0 12px",
              color: feedback.startsWith("⚠️") ? "#ffcc00" : feedback.startsWith("✅") ? "#00ff88" : "#ff4466",
            }}>{feedback}</div>
          )}
        </div>

        {/* Status bar */}
        {status === "running" && (
          <div style={{ marginBottom: 10 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 12px", borderRadius: 10, marginBottom: 8,
              background: positionOk ? "rgba(0,255,136,0.08)" : "rgba(255,34,68,0.08)",
              border: `1px solid ${positionOk ? "rgba(0,255,136,0.3)" : "rgba(255,34,68,0.3)"}`,
              transition: "all 0.2s",
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: positionOk ? "#00ff88" : "#ff2244",
                boxShadow: positionOk ? "0 0 6px #00ff88" : "0 0 6px #ff2244",
              }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: positionOk ? "#00ff88" : "#ff2244" }}>
                {positionOk ? "POSITION VALID — reps counting" : "INVALID POSITION"}
              </div>
            </div>

            {/* ── Checklist ── */}
            <div style={{
              padding: "8px 12px", borderRadius: 10, marginBottom: 8,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
            }}>
              {checks.map((c, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "3px 0",
                  borderBottom: i < checks.length-1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <span style={{ fontSize: 12 }}>{c.pass ? "✅" : "❌"}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, minWidth: 100,
                                 color: c.pass ? "#00ff88" : "#ff4466" }}>{c.label}</span>
                  <span style={{ fontSize: 11, opacity: 0.5 }}>{c.value}</span>
                  {!c.pass && <span style={{ fontSize: 11, color: "#ffcc00", marginLeft: "auto" }}>{c.hint}</span>}
                </div>
              ))}
            </div>

            {/* ── ALL angles display ── */}
            <div style={{
              padding: "8px 12px", borderRadius: 10,
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ fontSize: 10, opacity: 0.4, marginBottom: 6, letterSpacing: 1 }}>
                LIVE ANGLES (use to calibrate)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                <AngleBox label="Elbow" value={angles.elbow} unit="°"
                  color={angles.elbow >= TOP_ELBOW_ANGLE ? "#00ff88" : angles.elbow <= BOTTOM_ELBOW_ANGLE ? "#ff6644" : "#ffcc00"} />
                <AngleBox label="Body" value={angles.body} unit="°"
                  color={angles.body >= BODY_ANGLE_MIN ? "#00ff88" : "#ff4466"} />
                <AngleBox label="Knee" value={angles.knee} unit="°"
                  color={angles.knee >= KNEE_STRAIGHT_MIN ? "#00ff88" : "#ff4466"} />
                <AngleBox label="Hip offset" value={angles.hipOffset} unit="%"
                  color={Math.abs(angles.hipOffset) < HIP_BAND*100 ? "#00ff88" : "#ff4466"} />
                <AngleBox label="Body span" value={angles.verticalSpan} unit="%"
                  color={angles.verticalSpan < HORIZONTAL_MAX*100 ? "#00ff88" : "#ff4466"} />
                <AngleBox label="FPS" value={fps} unit=""
                  color={fps >= 8 ? "#00ff88" : "#ffcc00"} />
              </div>
            </div>
          </div>
        )}

        {/* Video */}
        <div style={{
          position: "relative", width: "100%", aspectRatio: "4 / 3",
          background: "#111", borderRadius: 14, overflow: "hidden",
          border: `1px solid ${positionOk ? "rgba(0,255,136,0.2)" : "rgba(255,34,68,0.25)"}`,
          marginBottom: 12, transition: "border-color 0.3s",
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
            position: "absolute", top: 8, left: 8, padding: "6px 10px",
            borderRadius: 8, background: "rgba(0,0,0,0.75)", fontSize: 11, lineHeight: 1.5,
          }}>
            <div style={{ opacity: 0.5 }}>Landmarks: {landmarks}/33</div>
            <div style={{ color: positionOk ? "#00ff88" : "#ff2244", fontWeight: 700 }}>
              {positionOk ? "● ACTIVE" : "● INVALID"}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button onClick={start} disabled={status === "loading" || status === "running"} style={{
            flex: 1, padding: "13px 0", borderRadius: 10, border: 0, fontWeight: 800, fontSize: 14,
            cursor: status === "loading" || status === "running" ? "not-allowed" : "pointer",
            background: status === "running" ? "rgba(0,255,136,0.15)" : "#00ff88",
            color: status === "running" ? "#00ff88" : "#000",
          }}>
            {status === "loading" ? "Loading..." : status === "running" ? "Running ✓" : "Start"}
          </button>
          <button onClick={stop} disabled={status !== "running" && status !== "loading"} style={{
            flex: 1, padding: "13px 0", borderRadius: 10, fontWeight: 800, fontSize: 14,
            border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer",
            background: "transparent", color: "white",
          }}>Stop</button>
          <button onClick={resetCounter} disabled={status !== "running"} style={{
            padding: "13px 16px", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 12,
            border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
            color: "rgba(255,255,255,0.4)",
          }}>Reset</button>
        </div>

        <p style={{ opacity: 0.4, fontSize: 12, margin: "0 0 12px" }}>{message}</p>

        {/* Thresholds reference */}
        <div style={{
          padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)", fontSize: 11, lineHeight: 1.8,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: "#00ff88", fontSize: 12 }}>
            Current thresholds (tweak based on live angles above)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px", opacity: 0.6 }}>
            <span>Body span must be: &lt;{Math.round(HORIZONTAL_MAX*100)}%</span>
            <span>Hip offset: &lt;±{Math.round(HIP_BAND*100)}%</span>
            <span>Body angle: &gt;{BODY_ANGLE_MIN}°</span>
            <span>Knee angle: &gt;{KNEE_STRAIGHT_MIN}°</span>
            <span>Elbow top: &gt;{TOP_ELBOW_ANGLE}°</span>
            <span>Elbow bottom: &lt;{BOTTOM_ELBOW_ANGLE}°</span>
          </div>
          <div style={{ marginTop: 8, opacity: 0.4 }}>
            🔴 Red = wrong position · 🟢 Green = valid · Checks run every frame (not just at start)
          </div>
        </div>

      </div>
    </main>
  );
}

function AngleBox({ label, value, unit, color }: {
  label: string; value: number; unit: string; color: string;
}) {
  return (
    <div style={{
      padding: "6px 8px", borderRadius: 8,
      background: "rgba(0,0,0,0.4)", border: `1px solid ${color}33`,
      textAlign: "center",
    }}>
      <div style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>
        {value}{unit}
      </div>
      <div style={{ fontSize: 9, opacity: 0.5, marginTop: 2, letterSpacing: 0.5 }}>
        {label.toUpperCase()}
      </div>
    </div>
  );
}
