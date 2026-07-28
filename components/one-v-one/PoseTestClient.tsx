"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { PoseLandmarker as PoseLandmarkerType } from "@mediapipe/tasks-vision";

// ── Types ──────────────────────────────────────────────────────────
type AppScreen = "setup" | "countdown" | "battle" | "results";
type PushupPhase = "no_plank" | "top" | "descending" | "bottom" | "ascending";
type Status = "idle" | "loading" | "running" | "error";

// ── Constants ──────────────────────────────────────────────────────
const MODEL_PATH = "/models/pose_landmarker_lite.task";
const WASM_PATH  = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const DETECTION_INTERVAL_MS = 66;
const BATTLE_DURATION_SEC   = 30;
const POSITION_HOLD_FRAMES  = 8; // must be valid for N consecutive frames before countdown

// Rep thresholds
const TOP_ELBOW    = 150;
const BOTTOM_ELBOW = 95;
const MIN_REP_MS   = 700;

// Position thresholds
const HORIZONTAL_MAX     = 0.28;
const HIP_BAND           = 0.14;
const BODY_ANGLE_MIN     = 150;
const KNEE_STRAIGHT_MIN  = 140;
const STAND_UP_VERTICAL  = 0.40;
const VIS_MIN            = 0.40;

const LM = {
  LEFT_SHOULDER:11, RIGHT_SHOULDER:12,
  LEFT_ELBOW:13,   RIGHT_ELBOW:14,
  LEFT_WRIST:15,   RIGHT_WRIST:16,
  LEFT_HIP:23,     RIGHT_HIP:24,
  LEFT_KNEE:25,    RIGHT_KNEE:26,
  LEFT_ANKLE:27,   RIGHT_ANKLE:28,
};

type Landmark = { x:number; y:number; z:number; visibility?:number };
type CheckResult = { label:string; pass:boolean; value:string; hint:string };
type Angles = { elbow:number; body:number; knee:number; hipOffset:number; verticalSpan:number };

// ── Pose math ──────────────────────────────────────────────────────
function vis(lm: Landmark) { return lm.visibility ?? 1; }

function angleDeg(a: Landmark, b: Landmark, c: Landmark) {
  const ab = { x: a.x-b.x, y: a.y-b.y };
  const cb = { x: c.x-b.x, y: c.y-b.y };
  const dot = ab.x*cb.x + ab.y*cb.y;
  const mag = Math.sqrt(ab.x**2+ab.y**2) * Math.sqrt(cb.x**2+cb.y**2);
  if (mag === 0) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, dot/mag))) * 180) / Math.PI;
}

function getBestSide(lms: Landmark[]) {
  const pick = (side: "L"|"R") => {
    const s = side==="L" ? lms[LM.LEFT_SHOULDER] : lms[LM.RIGHT_SHOULDER];
    const e = side==="L" ? lms[LM.LEFT_ELBOW]    : lms[LM.RIGHT_ELBOW];
    const w = side==="L" ? lms[LM.LEFT_WRIST]    : lms[LM.RIGHT_WRIST];
    const h = side==="L" ? lms[LM.LEFT_HIP]      : lms[LM.RIGHT_HIP];
    const k = side==="L" ? lms[LM.LEFT_KNEE]     : lms[LM.RIGHT_KNEE];
    const a = side==="L" ? lms[LM.LEFT_ANKLE]    : lms[LM.RIGHT_ANKLE];
    return { s,e,w,h,k,a, score: vis(s)+vis(e)+vis(w)+vis(h)+vis(k)+vis(a) };
  };
  const L=pick("L"), R=pick("R");
  return L.score >= R.score ? L : R;
}

function checkPosition(lms: Landmark[]): { ok:boolean; checks:CheckResult[]; angles:Angles } {
  const { s,e,w,h,k,a,score } = getBestSide(lms);
  const elbowAngle    = Math.round(angleDeg(s,e,w));
  const bodyAngle     = Math.round(angleDeg(s,h,a));
  const kneeAngle     = Math.round(angleDeg(h,k,a));
  const verticalSpan  = Math.round(Math.abs(s.y-a.y)*100);
  const hipOffsetRaw  = h.y - s.y;
  const hipOffsetPct  = Math.round(hipOffsetRaw*100);
  const angles: Angles = { elbow:elbowAngle, body:bodyAngle, knee:kneeAngle,
                            hipOffset:hipOffsetPct, verticalSpan };

  if (score/6 < VIS_MIN) return { ok:false, angles, checks:[
    { label:"Visibility", pass:false, value:"body not in frame", hint:"Move back — show full body" }
  ]};

  const checks: CheckResult[] = [];

  const isHoriz = verticalSpan < HORIZONTAL_MAX*100;
  checks.push({ label:"Body flat", pass:isHoriz,
    value:`span ${verticalSpan}%`, hint:isHoriz?"✓":`Lie flat — need <${Math.round(HORIZONTAL_MAX*100)}%` });

  const hipsOk = Math.abs(hipOffsetRaw) < HIP_BAND;
  const hipHint = hipOffsetRaw > HIP_BAND  ? "Hips too low / knees down"
                : hipOffsetRaw < -HIP_BAND ? "Hips too high / piked"
                : "✓";
  checks.push({ label:"Hips level", pass:hipsOk, value:`offset ${hipOffsetPct>0?"+":""}${hipOffsetPct}%`, hint:hipHint });

  const kneesOk = kneeAngle >= KNEE_STRAIGHT_MIN;
  checks.push({ label:"Legs straight", pass:kneesOk,
    value:`knee ${kneeAngle}°`, hint:kneesOk?"✓":`Lift knees — need >${KNEE_STRAIGHT_MIN}°` });

  const bodyOk = bodyAngle >= BODY_ANGLE_MIN;
  checks.push({ label:"Body straight", pass:bodyOk,
    value:`body ${bodyAngle}°`, hint:bodyOk?"✓":`Tighten core — need >${BODY_ANGLE_MIN}°` });

  return { ok: isHoriz && hipsOk && kneesOk && bodyOk, checks, angles };
}

function isStandingUp(lms: Landmark[]) {
  const { s,a } = getBestSide(lms);
  return (a.y - s.y) > STAND_UP_VERTICAL;
}

// ── AI Voice ───────────────────────────────────────────────────────
function speak(text: string, rate = 1.0) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = rate;
  utt.pitch = 1.05;
  utt.volume = 1;
  // Pick a deeper voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.name.toLowerCase().includes("male") ||
    v.name.toLowerCase().includes("guy") ||
    v.name.toLowerCase().includes("daniel") ||
    v.name.toLowerCase().includes("alex")
  );
  if (preferred) utt.voice = preferred;
  window.speechSynthesis.speak(utt);
}

// ── Component ──────────────────────────────────────────────────────
export default function PoseTestClient() {
  const videoRef      = useRef<HTMLVideoElement|null>(null);
  const canvasRef     = useRef<HTMLCanvasElement|null>(null);
  const streamRef     = useRef<MediaStream|null>(null);
  const landmarkerRef = useRef<PoseLandmarkerType|null>(null);
  const rafRef        = useRef<number|null>(null);

  const runningRef      = useRef(false);
  const lastDetectRef   = useRef(0);
  const fpsCntRef       = useRef(0);
  const lastFpsRef      = useRef(performance.now());
  const phaseRef        = useRef<PushupPhase>("no_plank");
  const posOkRef        = useRef(false);
  const posHoldRef      = useRef(0); // consecutive valid frames
  const repCountRef     = useRef(0);
  const lastRepRef      = useRef(0);
  const screenRef       = useRef<AppScreen>("setup");
  const battleStartRef  = useRef(0);
  const countdownValRef = useRef(5);

  const [screen,      setScreen]      = useState<AppScreen>("setup");
  const [loadStatus,  setLoadStatus]  = useState<Status>("idle");
  const [fps,         setFps]         = useState(0);
  const [landmarks,   setLandmarks]   = useState(0);
  const [repCount,    setRepCount]    = useState(0);
  const [phase,       setPhase]       = useState<PushupPhase>("no_plank");
  const [positionOk,  setPositionOk]  = useState(false);
  const [checks,      setChecks]      = useState<CheckResult[]>([]);
  const [angles,      setAngles]      = useState<Angles>({ elbow:0,body:0,knee:0,hipOffset:0,verticalSpan:0 });
  const [countdown,   setCountdown]   = useState(5);
  const [battleTime,  setBattleTime]  = useState(BATTLE_DURATION_SEC);
  const [posHoldPct,  setPosHoldPct]  = useState(0); // 0-100 fill for "hold" indicator
  const [loadMsg,     setLoadMsg]     = useState("");

  // ── MediaPipe setup ────────────────────────────────────────────
  async function createLandmarker() {
    const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    const opts = {
      baseOptions: { modelAssetPath:MODEL_PATH, delegate:"GPU" as const },
      runningMode:"VIDEO" as const, numPoses:1,
      minPoseDetectionConfidence:0.5, minPosePresenceConfidence:0.5,
      minTrackingConfidence:0.5, outputSegmentationMasks:false,
    };
    try   { return await PoseLandmarker.createFromOptions(vision, opts); }
    catch { return await PoseLandmarker.createFromOptions(vision,
              { ...opts, baseOptions:{ modelAssetPath:MODEL_PATH, delegate:"CPU" as const } }); }
  }

  // ── Start camera + model ───────────────────────────────────────
  async function startCamera() {
    try {
      setLoadStatus("loading"); setLoadMsg("Starting camera...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video:{ width:{ideal:640}, height:{ideal:480},
                frameRate:{ideal:30,max:30}, facingMode:"user" }, audio:false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream; await video.play();
      setLoadMsg("Loading pose model...");
      landmarkerRef.current = await createLandmarker();
      resetRefs();
      runningRef.current = true;
      setLoadStatus("running");
      loop();
    } catch(err) {
      setLoadStatus("error");
      setLoadMsg(err instanceof Error ? err.message : "Camera failed.");
    }
  }

  function stopCamera() {
    runningRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    landmarkerRef.current?.close();
    streamRef.current = null; landmarkerRef.current = null;
  }

  function resetRefs() {
    phaseRef.current      = "no_plank";
    posOkRef.current      = false;
    posHoldRef.current    = 0;
    repCountRef.current   = 0;
    lastRepRef.current    = 0;
    screenRef.current     = "setup";
    battleStartRef.current = 0;
    countdownValRef.current = 5;
    setScreen("setup"); setRepCount(0); setPhase("no_plank");
    setPositionOk(false); setChecks([]); setCountdown(5);
    setBattleTime(BATTLE_DURATION_SEC); setPosHoldPct(0);
  }

  // ── Transition: setup → countdown ─────────────────────────────
  function beginCountdown() {
    screenRef.current = "countdown";
    setScreen("countdown");
    countdownValRef.current = 5;
    setCountdown(5);
    speak("Both players, get your ass into pushup position! Five...");
    let n = 5;
    const tick = setInterval(() => {
      n--;
      countdownValRef.current = n;
      setCountdown(n);
      if (n > 0) speak(String(n), 0.9);
      if (n <= 0) {
        clearInterval(tick);
        speak("GO!", 1.3);
        beginBattle();
      }
    }, 1100);
  }

  // ── Transition: countdown → battle ────────────────────────────
  function beginBattle() {
    screenRef.current      = "battle";
    battleStartRef.current = performance.now();
    phaseRef.current       = "no_plank";
    repCountRef.current    = 0;
    setScreen("battle");
    setRepCount(0);
    setBattleTime(BATTLE_DURATION_SEC);
  }

  // ── Transition: battle → results ──────────────────────────────
  function endBattle() {
    screenRef.current = "results";
    setScreen("results");
    window.speechSynthesis?.cancel();
    const r = repCountRef.current;
    if      (r >= 20) speak(`BEAST MODE! ${r} reps! You destroyed it!`, 1.1);
    else if (r >= 10) speak(`${r} reps! Not bad! Can you do better next time?`, 1.0);
    else              speak(`${r} reps. Come on, you can do more than that!`, 0.95);
  }

  // ── Core pose processing ───────────────────────────────────────
  function processPose(lms: Landmark[]) {
    const result = checkPosition(lms);
    setAngles(result.angles);
    setChecks(result.checks);

    const wasOk = posOkRef.current;
    const nowOk = result.ok;
    posOkRef.current = nowOk;
    setPositionOk(nowOk);

    const currentScreen = screenRef.current;

    // ── SETUP screen: wait for valid position → auto-start countdown
    if (currentScreen === "setup") {
      if (nowOk) {
        posHoldRef.current = Math.min(posHoldRef.current + 1, POSITION_HOLD_FRAMES);
      } else {
        posHoldRef.current = Math.max(posHoldRef.current - 2, 0);
      }
      const holdPct = Math.round((posHoldRef.current / POSITION_HOLD_FRAMES) * 100);
      setPosHoldPct(holdPct);

      if (posHoldRef.current >= POSITION_HOLD_FRAMES) {
        posHoldRef.current = 0;
        beginCountdown();
      }
      return;
    }

    // ── BATTLE screen: run rep counter ────────────────────────────
    if (currentScreen === "battle") {
      // Check if time is up
      const elapsed = (performance.now() - battleStartRef.current) / 1000;
      const remaining = Math.max(0, BATTLE_DURATION_SEC - elapsed);
      setBattleTime(Math.ceil(remaining));
      if (remaining <= 0) { endBattle(); return; }

      // Standing up mid-battle → invalidate phase
      if (isStandingUp(lms)) {
        if (phaseRef.current !== "no_plank") { phaseRef.current="no_plank"; setPhase("no_plank"); }
        return;
      }

      const eAngle = result.angles.elbow;
      const now    = performance.now();

      // Position just became invalid → pause phase
      if (wasOk && !nowOk) { phaseRef.current="no_plank"; setPhase("no_plank"); return; }
      if (!nowOk) return;

      switch (phaseRef.current) {
        case "no_plank":
          if (eAngle >= TOP_ELBOW) { phaseRef.current="top"; setPhase("top"); }
          break;
        case "top":
          if (eAngle < TOP_ELBOW - 15) { phaseRef.current="descending"; setPhase("descending"); }
          break;
        case "descending":
          if (eAngle <= BOTTOM_ELBOW)  { phaseRef.current="bottom"; setPhase("bottom"); }
          else if (eAngle >= TOP_ELBOW){ phaseRef.current="top"; setPhase("top"); }
          break;
        case "bottom":
          if (eAngle > BOTTOM_ELBOW+10){ phaseRef.current="ascending"; setPhase("ascending"); }
          break;
        case "ascending":
          if (eAngle >= TOP_ELBOW) {
            if (now - lastRepRef.current >= MIN_REP_MS) {
              repCountRef.current++; lastRepRef.current=now;
              setRepCount(repCountRef.current);
            }
            phaseRef.current="top"; setPhase("top");
          } else if (eAngle <= BOTTOM_ELBOW) {
            phaseRef.current="bottom"; setPhase("bottom");
          }
          break;
      }
    }
  }

  // ── Draw skeleton ──────────────────────────────────────────────
  function drawPose(lms: Landmark[], currentPhase: PushupPhase, isOk: boolean, currentScreen: AppScreen) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!lms.length) return;

    const connections = [
      [11,12],[11,13],[13,15],[12,14],[14,16],
      [11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],
    ];

    const phaseColors: Record<PushupPhase,string> = {
      no_plank:"#ff2244", top:"#00ff88",
      descending:"#ffcc00", bottom:"#ff6644", ascending:"#44aaff",
    };

    const color    = (currentScreen==="battle" && isOk) ? phaseColors[currentPhase] : isOk ? "#00ff88" : "#ff2244";
    const dotColor = isOk ? "#ffffff" : "#ff6666";

    ctx.lineWidth=5; ctx.strokeStyle=color; ctx.fillStyle=dotColor;
    for (const [si,ei] of connections) {
      const a=lms[si], b=lms[ei];
      if (!a||!b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x*canvas.width, a.y*canvas.height);
      ctx.lineTo(b.x*canvas.width, b.y*canvas.height);
      ctx.stroke();
    }
    for (const pt of lms) {
      ctx.beginPath();
      ctx.arc(pt.x*canvas.width, pt.y*canvas.height, 5, 0, Math.PI*2);
      ctx.fill();
    }
  }

  // ── rAF loop ───────────────────────────────────────────────────
  const loop = useCallback(() => {
    const video=videoRef.current, canvas=canvasRef.current, detector=landmarkerRef.current;
    if (!runningRef.current||!video||!canvas||!detector) return;

    if (video.videoWidth>0 && video.videoHeight>0) {
      if (canvas.width !==video.videoWidth)  canvas.width =video.videoWidth;
      if (canvas.height!==video.videoHeight) canvas.height=video.videoHeight;

      const now = performance.now();
      if (now - lastDetectRef.current >= DETECTION_INTERVAL_MS) {
        lastDetectRef.current = now;
        if (screenRef.current==="results") { rafRef.current=requestAnimationFrame(loop); return; }

        const result  = detector.detectForVideo(video, now);
        const lms     = (result.landmarks?.[0]??[]) as Landmark[];
        setLandmarks(lms.length);
        drawPose(lms, phaseRef.current, posOkRef.current, screenRef.current);
        if (lms.length>0) processPose(lms);

        fpsCntRef.current++;
        const elapsed = now - lastFpsRef.current;
        if (elapsed>=1000) {
          setFps(Math.round((fpsCntRef.current*1000)/elapsed));
          fpsCntRef.current=0; lastFpsRef.current=now;
        }
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Load voices on mount
    if (typeof window !== "undefined") window.speechSynthesis?.getVoices();
    startCamera();
    return () => { stopCamera(); window.speechSynthesis?.cancel(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Phase label / color ────────────────────────────────────────
  const phaseLabel: Record<PushupPhase,string> = {
    no_plank:"Get in position", top:"DOWN ↓",
    descending:"Going down...", bottom:"PUSH UP ↑", ascending:"Almost there...",
  };
  const phaseColor: Record<PushupPhase,string> = {
    no_plank:"#ff2244", top:"#00ff88",
    descending:"#ffcc00", bottom:"#ff6644", ascending:"#44aaff",
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div style={{
      position:"fixed", inset:0, background:"#060606",
      fontFamily:"'DM Mono','Courier New',monospace", overflow:"hidden", color:"white",
    }}>

      {/* ── VIDEO (always behind, hidden on results) ── */}
      <video ref={videoRef} playsInline muted autoPlay style={{
        position:"absolute", inset:0, width:"100%", height:"100%",
        objectFit:"cover", transform:"scaleX(-1)",
        opacity: screen==="results" ? 0 : 1, transition:"opacity 0.5s",
      }} />
      <canvas ref={canvasRef} style={{
        position:"absolute", inset:0, width:"100%", height:"100%",
        transform:"scaleX(-1)",
        opacity: screen==="results" ? 0 : 1, transition:"opacity 0.5s",
      }} />

      {/* dark vignette overlay so text is readable */}
      {screen !== "results" && (
        <div style={{
          position:"absolute", inset:0, pointerEvents:"none",
          background:"linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 35%, transparent 60%, rgba(0,0,0,0.7) 100%)",
        }} />
      )}

      {/* ════════════════════════════════════════════
          SCREEN: SETUP
      ════════════════════════════════════════════ */}
      {screen === "setup" && (
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", justifyContent:"space-between", padding:20 }}>

          {/* Top bar */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:22, fontWeight:900, letterSpacing:-1 }}>
                LOCKED'N<span style={{ color:"#00ff88" }}>.</span>
              </div>
              <div style={{ fontSize:11, opacity:0.4, marginTop:2 }}>GET IN POSITION</div>
            </div>
            <div style={{
              padding:"4px 10px", borderRadius:20,
              background: positionOk ? "rgba(0,255,136,0.15)" : "rgba(255,34,68,0.15)",
              border:`1px solid ${positionOk ? "#00ff88" : "#ff2244"}`,
              fontSize:11, fontWeight:700,
              color: positionOk ? "#00ff88" : "#ff2244",
            }}>
              {positionOk ? "● POSITION VALID" : "● FIX POSITION"}
            </div>
          </div>

          {/* Checklist */}
          <div style={{
            background:"rgba(0,0,0,0.7)", borderRadius:16, padding:16,
            backdropFilter:"blur(8px)", border:"1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{ fontSize:11, opacity:0.4, letterSpacing:1, marginBottom:10 }}>
              POSITION CHECK
            </div>
            {checks.map((c,i) => (
              <div key={i} style={{
                display:"flex", alignItems:"center", gap:10, padding:"6px 0",
                borderBottom: i<checks.length-1 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}>
                <span style={{ fontSize:16 }}>{c.pass?"✅":"❌"}</span>
                <span style={{ fontSize:13, fontWeight:700, flex:1,
                               color:c.pass?"#00ff88":"#ff4466" }}>{c.label}</span>
                <span style={{ fontSize:11, opacity:0.5 }}>{c.value}</span>
              </div>
            ))}
            {checks.length === 0 && (
              <div style={{ opacity:0.4, fontSize:13, textAlign:"center", padding:"8px 0" }}>
                {loadStatus==="loading" ? loadMsg : "Point camera sideways at your full body"}
              </div>
            )}

            {/* Hold progress bar */}
            {positionOk && (
              <div style={{ marginTop:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, opacity:0.6, marginBottom:6 }}>
                  <span>Hold position...</span>
                  <span>{posHoldPct}%</span>
                </div>
                <div style={{ height:6, borderRadius:3, background:"rgba(255,255,255,0.1)", overflow:"hidden" }}>
                  <div style={{
                    height:"100%", borderRadius:3,
                    width:`${posHoldPct}%`,
                    background:"linear-gradient(90deg, #00ff88, #00ccff)",
                    transition:"width 0.15s",
                  }} />
                </div>
                <div style={{ fontSize:11, opacity:0.4, marginTop:6, textAlign:"center" }}>
                  Starting automatically...
                </div>
              </div>
            )}
          </div>

          {/* FPS badge */}
          <div style={{ alignSelf:"flex-end", opacity:0.3, fontSize:11 }}>
            {fps}fps · {landmarks}/33
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          SCREEN: COUNTDOWN
      ════════════════════════════════════════════ */}
      {screen === "countdown" && (
        <div style={{
          position:"absolute", inset:0,
          background:"rgba(0,0,0,0.82)",
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center",
          gap:20,
        }}>
          <div style={{ fontSize:14, letterSpacing:4, opacity:0.5, fontWeight:700 }}>
            GET READY
          </div>
          <div style={{
            fontSize: countdown === 0 ? 80 : 140,
            fontWeight:900,
            letterSpacing:-6,
            lineHeight:1,
            color: countdown === 0 ? "#00ff88" : countdown <= 2 ? "#ff6644" : "white",
            transition:"all 0.15s",
            textShadow: countdown===0 ? "0 0 60px #00ff8888" : "none",
          }}>
            {countdown === 0 ? "GO!" : countdown}
          </div>
          <div style={{ fontSize:13, opacity:0.4 }}>
            {countdown > 0 ? `${BATTLE_DURATION_SEC}s battle · pushups` : ""}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          SCREEN: BATTLE
      ════════════════════════════════════════════ */}
      {screen === "battle" && (
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", justifyContent:"space-between" }}>

          {/* Top HUD */}
          <div style={{ padding:"20px 20px 0", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>

            {/* Rep counter — big, overlaid top-left */}
            <div>
              <div style={{
                fontSize:100, fontWeight:900, lineHeight:0.9, letterSpacing:-5,
                color:"#00ff88",
                textShadow:"0 0 40px rgba(0,255,136,0.4)",
              }}>
                {repCount}
              </div>
              <div style={{ fontSize:11, opacity:0.5, letterSpacing:2, marginTop:4 }}>REPS</div>
            </div>

            {/* Timer — top right */}
            <div style={{ textAlign:"right" }}>
              <div style={{
                fontSize:52, fontWeight:900, letterSpacing:-2, lineHeight:1,
                color: battleTime <= 10 ? "#ff6644" : "white",
                textShadow: battleTime <= 10 ? "0 0 20px rgba(255,100,68,0.5)" : "none",
                transition:"color 0.3s, text-shadow 0.3s",
              }}>
                {battleTime}
              </div>
              <div style={{ fontSize:11, opacity:0.5, letterSpacing:2 }}>SEC</div>
            </div>
          </div>

          {/* Phase pill — center bottom of top section */}
          <div style={{ display:"flex", justifyContent:"center", marginTop:-20 }}>
            <div style={{
              padding:"6px 18px", borderRadius:30, fontSize:13, fontWeight:700,
              background:"rgba(0,0,0,0.6)", backdropFilter:"blur(8px)",
              border:`1px solid ${phaseColor[phase]}55`,
              color: phaseColor[phase],
              letterSpacing:1,
            }}>
              {phaseLabel[phase]}
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{
            padding:"0 20px 28px",
            display:"flex", justifyContent:"space-between", alignItems:"flex-end",
          }}>
            {/* Position status dot */}
            <div style={{
              display:"flex", alignItems:"center", gap:6,
              padding:"6px 12px", borderRadius:20,
              background:"rgba(0,0,0,0.6)", backdropFilter:"blur(8px)",
              border:`1px solid ${positionOk?"rgba(0,255,136,0.3)":"rgba(255,34,68,0.3)"}`,
              fontSize:12, fontWeight:700,
              color: positionOk?"#00ff88":"#ff2244",
            }}>
              <div style={{
                width:7, height:7, borderRadius:"50%",
                background: positionOk?"#00ff88":"#ff2244",
                boxShadow: positionOk?"0 0 6px #00ff88":"0 0 6px #ff2244",
              }} />
              {positionOk ? "COUNTING" : "INVALID"}
            </div>

            {/* FPS + stop */}
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ opacity:0.3, fontSize:11 }}>{fps}fps</span>
              <button
                onClick={() => { endBattle(); }}
                style={{
                  padding:"8px 16px", borderRadius:10,
                  border:"1px solid rgba(255,255,255,0.2)",
                  background:"rgba(0,0,0,0.5)", color:"rgba(255,255,255,0.6)",
                  fontSize:12, fontWeight:700, cursor:"pointer",
                  backdropFilter:"blur(8px)",
                }}>
                END
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          SCREEN: RESULTS
      ════════════════════════════════════════════ */}
      {screen === "results" && (
        <div style={{
          position:"absolute", inset:0,
          background:"linear-gradient(160deg, #0a0a0a 0%, #0d1a0f 50%, #0a0a0a 100%)",
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center",
          padding:24, gap:0,
        }}>

          {/* Logo */}
          <div style={{ fontSize:16, fontWeight:900, letterSpacing:-0.5, opacity:0.4, marginBottom:32 }}>
            LOCKED'N<span style={{ color:"#00ff88" }}>.</span>
          </div>

          {/* VS card */}
          <div style={{
            width:"100%", maxWidth:380,
            background:"rgba(255,255,255,0.04)",
            border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:24, overflow:"hidden",
          }}>

            {/* Winner banner */}
            <div style={{
              background:"linear-gradient(90deg, #00ff8822, #00ccff22)",
              borderBottom:"1px solid rgba(0,255,136,0.15)",
              padding:"12px 20px",
              textAlign:"center",
              fontSize:12, fontWeight:700, letterSpacing:3,
              color:"#00ff88",
            }}>
              {repCount > 0 ? "🏆 YOU WIN" : "BATTLE COMPLETE"}
            </div>

            {/* Score row */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", padding:"28px 20px" }}>

              {/* Player score */}
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:11, opacity:0.4, letterSpacing:2, marginBottom:8 }}>YOU</div>
                <div style={{ fontSize:72, fontWeight:900, letterSpacing:-4, color:"#00ff88", lineHeight:1 }}>
                  {repCount}
                </div>
                <div style={{ fontSize:11, opacity:0.4, marginTop:4 }}>REPS</div>
              </div>

              {/* VS divider */}
              <div style={{
                padding:"8px 16px", fontSize:14, fontWeight:900,
                opacity:0.25, letterSpacing:2,
              }}>VS</div>

              {/* Opponent score (placeholder) */}
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:11, opacity:0.4, letterSpacing:2, marginBottom:8 }}>OPPONENT</div>
                <div style={{ fontSize:72, fontWeight:900, letterSpacing:-4, color:"rgba(255,255,255,0.2)", lineHeight:1 }}>
                  —
                </div>
                <div style={{ fontSize:11, opacity:0.2, marginTop:4 }}>WAITING</div>
              </div>
            </div>

            {/* Stats row */}
            <div style={{
              display:"grid", gridTemplateColumns:"1fr 1fr 1fr",
              borderTop:"1px solid rgba(255,255,255,0.06)",
              padding:"14px 20px",
            }}>
              {[
                { label:"REPS", value:repCount },
                { label:"DURATION", value:`${BATTLE_DURATION_SEC}s` },
                { label:"RPM", value: Math.round((repCount / BATTLE_DURATION_SEC) * 60) },
              ].map((s,i) => (
                <div key={i} style={{ textAlign:"center" }}>
                  <div style={{ fontSize:20, fontWeight:900, color:"white" }}>{s.value}</div>
                  <div style={{ fontSize:9, opacity:0.35, letterSpacing:1, marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Motivational line */}
          <div style={{ marginTop:24, fontSize:13, opacity:0.4, textAlign:"center", maxWidth:280 }}>
            {repCount >= 20 ? "Absolute beast. Challenge someone now." :
             repCount >= 10 ? "Solid. You've got more in the tank." :
             "Every rep counts. Run it back."}
          </div>

          {/* Action buttons */}
          <div style={{ display:"flex", gap:12, marginTop:28, width:"100%", maxWidth:380 }}>
            <button
              onClick={() => { resetRefs(); }}
              style={{
                flex:1, padding:"16px 0", borderRadius:14, border:0,
                background:"#00ff88", color:"#000",
                fontSize:15, fontWeight:900, cursor:"pointer", letterSpacing:0.5,
              }}>
              RUN IT BACK
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title:"Locked'N", text:`Just hit ${repCount} pushups in ${BATTLE_DURATION_SEC}s on Locked'N 💪`, url:window.location.href });
                }
              }}
              style={{
                padding:"16px 18px", borderRadius:14,
                border:"1px solid rgba(255,255,255,0.15)",
                background:"transparent", color:"white",
                fontSize:15, fontWeight:700, cursor:"pointer",
              }}>
              SHARE
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
