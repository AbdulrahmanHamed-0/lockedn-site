"use client";

import { useEffect, useRef, useState } from "react";
import type { PoseLandmarker as PoseLandmarkerType } from "@mediapipe/tasks-vision";

type Status = "idle" | "loading" | "running" | "error";
type PushupPhase = "waiting" | "top" | "descending" | "bottom" | "ascending";

const MODEL_PATH = "/models/pose_landmarker_lite.task";
const WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

const DETECTION_INTERVAL_MS = 66; // ~15 FPS

// Pushup angle thresholds (degrees)
const TOP_ELBOW_ANGLE = 150;      // arms locked out
const BOTTOM_ELBOW_ANGLE = 95;    // arms bent at bottom
const BODY_STRAIGHT_ANGLE = 150;  // shoulder-hip-ankle alignment
const VISIBILITY_THRESHOLD = 0.5;
const MIN_REP_MS = 600;           // prevent double-counts

// MediaPipe landmark indices
const LM = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

type Landmark = { x: number; y: number; z: number; visibility?: number };

function angleDeg(a: Landmark, b: Landmark, c: Landmark): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.sqrt(ab.x ** 2 + ab.y ** 2) * Math.sqrt(cb.x ** 2 + cb.y ** 2);
  if (mag === 0) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

function vis(lm: Landmark): number {
  return lm.visibility ?? 1;
}

// Pick the side with better visibility (works for either side facing camera)
function getBestSideAngles(lms: Landmark[]): {
  elbowAngle: number;
  bodyAngle: number;
  sideVisible: boolean;
} {
  const leftVis =
    vis(lms[LM.LEFT_SHOULDER]) +
    vis(lms[LM.LEFT_ELBOW]) +
    vis(lms[LM.LEFT_WRIST]) +
    vis(lms[LM.LEFT_HIP]) +
    vis(lms[LM.LEFT_ANKLE]);

  const rightVis =
    vis(lms[LM.RIGHT_SHOULDER]) +
    vis(lms[LM.RIGHT_ELBOW]) +
    vis(lms[LM.RIGHT_WRIST]) +
    vis(lms[LM.RIGHT_HIP]) +
    vis(lms[LM.RIGHT_ANKLE]);

  const useLeft = leftVis >= rightVis;
  const s = useLeft ? lms[LM.LEFT_SHOULDER] : lms[LM.RIGHT_SHOULDER];
  const e = useLeft ? lms[LM.LEFT_ELBOW] : lms[LM.RIGHT_ELBOW];
  const w = useLeft ? lms[LM.LEFT_WRIST] : lms[LM.RIGHT_WRIST];
  const h = useLeft ? lms[LM.LEFT_HIP] : lms[LM.RIGHT_HIP];
  const a = useLeft ? lms[LM.LEFT_ANKLE] : lms[LM.RIGHT_ANKLE];

  const minVis = Math.max(leftVis, rightVis) / 5;
  const sideVisible = minVis >= VISIBILITY_THRESHOLD;

  return {
    elbowAngle: angleDeg(s, e, w),
    bodyAngle: angleDeg(s, h, a),
    sideVisible,
  };
}

export default function PoseTestClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarkerType | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const runningRef = useRef(false);
  const lastDetectTimeRef = useRef(0);
  const fpsFrameCountRef = useRef(0);
  const lastFpsUpdateRef = useRef(performance.now());

  // Pushup state machine (refs to avoid stale closure issues)
  const phaseRef = useRef<PushupPhase>("waiting");
  const repCountRef = useRef(0);
  const lastRepTimeRef = useRef(0);
  const currentElbowAngleRef = useRef(0);
  const currentBodyAngleRef = useRef(0);

  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("Click start to test pushup detection.");
  const [fps, setFps] = useState(0);
  const [landmarks, setLandmarks] = useState(0);
  const [repCount, setRepCount] = useState(0);
  const [phase, setPhase] = useState<PushupPhase>("waiting");
  const [noRepReason, setNoRepReason] = useState("");
  const [elbowAngle, setElbowAngle] = useState(0);
  const [bodyAngle, setBodyAngle] = useState(0);

  async function createPoseLandmarker() {
    const { FilesetResolver, PoseLandmarker } = await import(
      "@mediapipe/tasks-vision"
    );
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    try {
      return await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.55,
        minPosePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
        outputSegmentationMasks: false,
      });
    } catch {
      return await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.55,
        minPosePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
        outputSegmentationMasks: false,
      });
    }
  }

  async function start() {
    try {
      setStatus("loading");
      setMessage("Requesting camera permission...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Video element not found.");
      video.srcObject = stream;
      await video.play();

      setMessage("Loading MediaPipe model...");
      poseLandmarkerRef.current = await createPoseLandmarker();

      // Reset counter
      phaseRef.current = "waiting";
      repCountRef.current = 0;
      lastRepTimeRef.current = 0;
      setRepCount(0);
      setPhase("waiting");
      setNoRepReason("");

      runningRef.current = true;
      setStatus("running");
      setMessage("Get into pushup position sideways to camera.");

      renderLoop();
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Failed to start camera or MediaPipe."
      );
    }
  }

  function stop() {
    runningRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    poseLandmarkerRef.current?.close();
    poseLandmarkerRef.current = null;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

    setStatus("idle");
    setMessage("Stopped.");
    setFps(0);
    setLandmarks(0);
    setPhase("waiting");
    setNoRepReason("");
  }

  function resetCounter() {
    phaseRef.current = "waiting";
    repCountRef.current = 0;
    lastRepTimeRef.current = 0;
    setRepCount(0);
    setPhase("waiting");
    setNoRepReason("");
  }

  function processPushup(lms: Landmark[]) {
    const { elbowAngle, bodyAngle, sideVisible } = getBestSideAngles(lms);

    currentElbowAngleRef.current = elbowAngle;
    currentBodyAngleRef.current = bodyAngle;
    setElbowAngle(Math.round(elbowAngle));
    setBodyAngle(Math.round(bodyAngle));

    if (!sideVisible) {
      setNoRepReason("⚠️ Turn sideways to camera");
      phaseRef.current = "waiting";
      setPhase("waiting");
      return;
    }

    const bodyIsStraight = bodyAngle >= BODY_STRAIGHT_ANGLE;
    const now = performance.now();

    const prevPhase = phaseRef.current;

    if (!bodyIsStraight) {
      setNoRepReason("⚠️ Keep body straight");
    } else {
      setNoRepReason("");
    }

    switch (phaseRef.current) {
      case "waiting":
      case "top":
        if (elbowAngle >= TOP_ELBOW_ANGLE) {
          phaseRef.current = "top";
          setPhase("top");
        }
        break;

      case "descending":
        if (elbowAngle <= BOTTOM_ELBOW_ANGLE) {
          if (bodyIsStraight) {
            phaseRef.current = "bottom";
            setPhase("bottom");
          } else {
            setNoRepReason("⚠️ Keep body straight — no-rep!");
          }
        }
        break;

      case "bottom":
        if (elbowAngle > BOTTOM_ELBOW_ANGLE + 10) {
          phaseRef.current = "ascending";
          setPhase("ascending");
        }
        break;

      case "ascending":
        if (elbowAngle >= TOP_ELBOW_ANGLE) {
          const timeSinceLast = now - lastRepTimeRef.current;
          if (timeSinceLast >= MIN_REP_MS) {
            repCountRef.current += 1;
            lastRepTimeRef.current = now;
            setRepCount(repCountRef.current);
          }
          phaseRef.current = "top";
          setPhase("top");
        }
        break;
    }

    // Detect downward movement from top
    if (prevPhase === "top" && elbowAngle < TOP_ELBOW_ANGLE - 15) {
      phaseRef.current = "descending";
      setPhase("descending");
    }
  }

  async function renderLoop() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const poseLandmarker = poseLandmarkerRef.current;

    if (!runningRef.current || !video || !canvas || !poseLandmarker) return;

    if (video.videoWidth > 0 && video.videoHeight > 0) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const now = performance.now();

      if (now - lastDetectTimeRef.current >= DETECTION_INTERVAL_MS) {
        lastDetectTimeRef.current = now;

        const result = poseLandmarker.detectForVideo(video, now);
        const lms = result.landmarks?.[0] ?? [];

        drawPose(lms);
        setLandmarks(lms.length);

        if (lms.length > 0) {
          processPushup(lms as Landmark[]);
        }

        fpsFrameCountRef.current += 1;
        const elapsed = now - lastFpsUpdateRef.current;
        if (elapsed >= 1000) {
          setFps(Math.round((fpsFrameCountRef.current * 1000) / elapsed));
          fpsFrameCountRef.current = 0;
          lastFpsUpdateRef.current = now;
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(renderLoop);
  }

  function drawPose(landmarks: Landmark[]) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!landmarks.length) return;

    const connections = [
      [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
      [11, 23], [12, 24], [23, 24],
      [23, 25], [25, 27], [24, 26], [26, 28],
    ];

    // Color skeleton based on phase
    const phaseColors: Record<PushupPhase, string> = {
      waiting: "#888888",
      top: "#00ff88",
      descending: "#ffcc00",
      bottom: "#ff6644",
      ascending: "#44aaff",
    };
    const color = phaseColors[phaseRef.current] ?? "#00ff88";

    ctx.lineWidth = 5;
    ctx.strokeStyle = color;
    ctx.fillStyle = "#ffffff";

    for (const [start, end] of connections) {
      const a = landmarks[start];
      const b = landmarks[end];
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
      ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
      ctx.stroke();
    }

    for (const point of landmarks) {
      ctx.beginPath();
      ctx.arc(point.x * canvas.width, point.y * canvas.height, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const phaseLabel: Record<PushupPhase, string> = {
    waiting: "Get into position",
    top: "TOP — go down!",
    descending: "Going down...",
    bottom: "BOTTOM — push up!",
    ascending: "Pushing up...",
  };

  const phaseColor: Record<PushupPhase, string> = {
    waiting: "#888",
    top: "#00ff88",
    descending: "#ffcc00",
    bottom: "#ff6644",
    ascending: "#44aaff",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#080808",
        color: "white",
        padding: 20,
        fontFamily: "'DM Mono', 'Courier New', monospace",
      }}
    >
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

        {/* Big rep counter */}
        <div
          style={{
            textAlign: "center",
            padding: "20px 0 12px",
            borderRadius: 18,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              lineHeight: 1,
              color: repCount > 0 ? "#00ff88" : "rgba(255,255,255,0.15)",
              letterSpacing: -4,
              transition: "color 0.2s",
            }}
          >
            {repCount}
          </div>
          <div style={{ fontSize: 13, opacity: 0.5, marginTop: 4 }}>REPS</div>

          {/* Phase indicator */}
          <div
            style={{
              marginTop: 12,
              display: "inline-block",
              padding: "6px 16px",
              borderRadius: 30,
              fontSize: 13,
              fontWeight: 700,
              background: "rgba(0,0,0,0.5)",
              border: `1px solid ${phaseColor[phase]}44`,
              color: phaseColor[phase],
              letterSpacing: 0.5,
            }}
          >
            {phaseLabel[phase]}
          </div>

          {/* No-rep warning */}
          {noRepReason && (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "#ff6644",
                fontWeight: 600,
              }}
            >
              {noRepReason}
            </div>
          )}
        </div>

        {/* Angle meters */}
        {status === "running" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <AngleMeter
              label="Elbow"
              angle={elbowAngle}
              min={60}
              max={180}
              lowThreshold={BOTTOM_ELBOW_ANGLE}
              highThreshold={TOP_ELBOW_ANGLE}
            />
            <AngleMeter
              label="Body"
              angle={bodyAngle}
              min={100}
              max={180}
              lowThreshold={BODY_STRAIGHT_ANGLE}
              highThreshold={180}
              invertGood
            />
          </div>
        )}

        {/* Video feed */}
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "4 / 3",
            background: "#111",
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.1)",
            marginBottom: 14,
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scaleX(-1)",
            }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              transform: "scaleX(-1)",
            }}
          />

          {/* HUD overlay */}
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              padding: "8px 12px",
              borderRadius: 10,
              background: "rgba(0,0,0,0.7)",
              fontSize: 12,
              lineHeight: 1.6,
              backdropFilter: "blur(4px)",
            }}
          >
            <div style={{ opacity: 0.6 }}>Status: {status}</div>
            <div style={{ opacity: 0.6 }}>FPS: {fps}</div>
            <div style={{ opacity: 0.6 }}>Landmarks: {landmarks}/33</div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <button
            onClick={start}
            disabled={status === "loading" || status === "running"}
            style={{
              flex: 1,
              padding: "14px 0",
              borderRadius: 12,
              border: 0,
              cursor: status === "loading" || status === "running" ? "not-allowed" : "pointer",
              fontWeight: 800,
              fontSize: 15,
              background: status === "running" ? "rgba(0,255,136,0.15)" : "#00ff88",
              color: status === "running" ? "#00ff88" : "#000",
              letterSpacing: 0.5,
              transition: "all 0.2s",
            }}
          >
            {status === "loading" ? "Loading..." : status === "running" ? "Running ✓" : "Start"}
          </button>

          <button
            onClick={stop}
            disabled={status !== "running" && status !== "loading"}
            style={{
              flex: 1,
              padding: "14px 0",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.2)",
              cursor: "pointer",
              fontWeight: 800,
              fontSize: 15,
              background: "transparent",
              color: "white",
              letterSpacing: 0.5,
            }}
          >
            Stop
          </button>

          <button
            onClick={resetCounter}
            disabled={status !== "running"}
            style={{
              padding: "14px 18px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
              background: "transparent",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            Reset
          </button>
        </div>

        <p style={{ opacity: 0.5, fontSize: 13, margin: "0 0 14px" }}>{message}</p>

        {/* How to guide */}
        <div
          style={{
            padding: 16,
            borderRadius: 14,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8, color: "#00ff88" }}>
            How to use
          </div>
          <div style={{ opacity: 0.7 }}>
            📱 Place phone sideways (landscape or portrait on a stand) so your whole body is visible from the side.<br />
            🤸 Start in the top pushup position (arms extended). The counter detects: <strong>TOP → DOWN → BOTTOM → UP → TOP</strong> = 1 rep.<br />
            ✅ Skeleton turns <span style={{ color: "#00ff88" }}>green</span> at top, <span style={{ color: "#ffcc00" }}>yellow</span> going down, <span style={{ color: "#ff6644" }}>red</span> at bottom, <span style={{ color: "#44aaff" }}>blue</span> going up.<br />
            ⚠️ Both left and right side facing is supported automatically.
          </div>
        </div>
      </div>
    </main>
  );
}

// Angle meter sub-component
function AngleMeter({
  label,
  angle,
  min,
  max,
  lowThreshold,
  highThreshold,
  invertGood = false,
}: {
  label: string;
  angle: number;
  min: number;
  max: number;
  lowThreshold: number;
  highThreshold: number;
  invertGood?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, (angle - min) / (max - min)));
  const isGood = invertGood ? angle >= lowThreshold : angle >= highThreshold || angle <= lowThreshold;

  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          marginBottom: 6,
          opacity: 0.7,
        }}
      >
        <span>{label} angle</span>
        <span style={{ color: isGood ? "#00ff88" : "white", fontWeight: 700 }}>
          {angle}°
        </span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: "rgba(255,255,255,0.1)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct * 100}%`,
            borderRadius: 3,
            background: isGood ? "#00ff88" : "#ffcc00",
            transition: "width 0.1s, background 0.2s",
          }}
        />
      </div>
    </div>
  );
}