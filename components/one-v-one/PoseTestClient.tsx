"use client";

import { useEffect, useRef, useState } from "react";
import type { PoseLandmarker as PoseLandmarkerType } from "@mediapipe/tasks-vision";

type Status = "idle" | "loading" | "running" | "error";

const MODEL_PATH = "/models/pose_landmarker_lite.task";
const WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

// 15 FPS detection is enough for this smoke test and keeps phones cooler.
const DETECTION_INTERVAL_MS = 66;

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

  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("Click start to test MediaPipe.");
  const [fps, setFps] = useState(0);
  const [landmarks, setLandmarks] = useState(0);

  async function createPoseLandmarker() {
    const { FilesetResolver, PoseLandmarker } = await import(
      "@mediapipe/tasks-vision"
    );

    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

    try {
      return await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_PATH,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.55,
        minPosePresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
        outputSegmentationMasks: false,
      });
    } catch {
      // Some browsers/devices fail GPU delegate. CPU fallback keeps the test alive.
      return await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_PATH,
          delegate: "CPU",
        },
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

      runningRef.current = true;
      setStatus("running");
      setMessage("MediaPipe running. Move into frame.");

      renderLoop();
    } catch (error) {
      console.error(error);
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to start camera or MediaPipe."
      );
    }
  }

  function stop() {
    runningRef.current = false;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    poseLandmarkerRef.current?.close();
    poseLandmarkerRef.current = null;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    setStatus("idle");
    setMessage("Stopped.");
    setFps(0);
    setLandmarks(0);
  }

  async function renderLoop() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const poseLandmarker = poseLandmarkerRef.current;

    if (!runningRef.current || !video || !canvas || !poseLandmarker) {
      return;
    }

    if (video.videoWidth > 0 && video.videoHeight > 0) {
      if (
        canvas.width !== video.videoWidth ||
        canvas.height !== video.videoHeight
      ) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const now = performance.now();

      if (now - lastDetectTimeRef.current >= DETECTION_INTERVAL_MS) {
        lastDetectTimeRef.current = now;

        const result = poseLandmarker.detectForVideo(video, now);

        drawPose(result.landmarks?.[0] ?? []);
        setLandmarks(result.landmarks?.[0]?.length ?? 0);

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

  function drawPose(landmarks: Array<{ x: number; y: number }>) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!landmarks.length) return;

    const connections = [
      [11, 12],
      [11, 13],
      [13, 15],
      [12, 14],
      [14, 16],
      [11, 23],
      [12, 24],
      [23, 24],
      [23, 25],
      [25, 27],
      [24, 26],
      [26, 28],
    ];

    ctx.lineWidth = 4;
    ctx.strokeStyle = "#00ff88";
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
      ctx.arc(point.x * canvas.width, point.y * canvas.height, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050505",
        color: "white",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 36, marginBottom: 8 }}>Locked'n 1v1 Pose Test</h1>
        <p style={{ opacity: 0.75, marginBottom: 20 }}>
          Step 1: local camera + MediaPipe pose detection.
        </p>

        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "4 / 3",
            background: "#111",
            borderRadius: 18,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.12)",
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

          <div
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              padding: "10px 12px",
              borderRadius: 12,
              background: "rgba(0,0,0,0.65)",
              fontSize: 14,
            }}
          >
            <div>Status: {status}</div>
            <div>Pose FPS: {fps}</div>
            <div>Landmarks: {landmarks}/33</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
          <button
            onClick={start}
            disabled={status === "loading" || status === "running"}
            style={{
              padding: "12px 18px",
              borderRadius: 12,
              border: 0,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Start test
          </button>

          <button
            onClick={stop}
            disabled={status !== "running"}
            style={{
              padding: "12px 18px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.25)",
              cursor: "pointer",
              fontWeight: 700,
              background: "transparent",
              color: "white",
            }}
          >
            Stop
          </button>
        </div>

        <p style={{ marginTop: 14, opacity: 0.8 }}>{message}</p>

        <div
          style={{
            marginTop: 22,
            padding: 16,
            borderRadius: 14,
            background: "rgba(255,255,255,0.06)",
            lineHeight: 1.6,
          }}
        >
          <strong>Test goal:</strong> stand in frame and confirm it shows{" "}
          <strong>33 landmarks</strong>. For pushups later, we need shoulders,
          elbows, wrists, hips, knees, and ankles visible.
        </div>
      </div>
    </main>
  );
}
