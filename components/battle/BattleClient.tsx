//DEV NOTE : Friends 1v1 ... actual 1v1 battle ...

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, getPlayerId, type Room } from "@/lib/supabase";
import type { PoseLandmarker as PoseLandmarkerType } from "@mediapipe/tasks-vision";

interface Props { roomId: string; }

type AppScreen   = "loading" | "setup" | "countdown" | "battle" | "results";
type PushupPhase = "no_plank"|"top"|"descending"|"bottom"|"ascending";

const MODEL_PATH            = "/models/pose_landmarker_lite.task";
const WASM_PATH             = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const DETECTION_INTERVAL_MS = 66;
const BATTLE_DURATION_SEC   = 30;
const POSITION_HOLD_FRAMES  = 8;
const TOP_ELBOW             = 150;
const BOTTOM_ELBOW          = 95;
const MIN_REP_MS            = 700;
const HORIZONTAL_MAX        = 0.28;
const HIP_BAND              = 0.14;
const BODY_ANGLE_MIN        = 150;
const KNEE_STRAIGHT_MIN     = 140;
const STAND_UP_VERTICAL     = 0.40;
const VIS_MIN               = 0.40;
const SYNC_EVERY_N_REPS     = 1;

const LM = {
  LEFT_SHOULDER:11, RIGHT_SHOULDER:12, LEFT_ELBOW:13,  RIGHT_ELBOW:14,
  LEFT_WRIST:15,    RIGHT_WRIST:16,    LEFT_HIP:23,    RIGHT_HIP:24,
  LEFT_KNEE:25,     RIGHT_KNEE:26,     LEFT_ANKLE:27,  RIGHT_ANKLE:28,
};

type Landmark    = { x:number; y:number; z:number; visibility?:number };
type CheckResult = { label:string; pass:boolean; value:string; hint:string };
type Angles      = { elbow:number; body:number; knee:number; hipOffset:number; verticalSpan:number };

function vis(lm: Landmark) { return lm.visibility ?? 1; }

function angleDeg(a: Landmark, b: Landmark, c: Landmark) {
  const ab = { x:a.x-b.x, y:a.y-b.y };
  const cb = { x:c.x-b.x, y:c.y-b.y };
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
    return { s,e,w,h,k,a, score:vis(s)+vis(e)+vis(w)+vis(h)+vis(k)+vis(a) };
  };
  const L=pick("L"), R=pick("R");
  return L.score >= R.score ? L : R;
}

function checkPosition(lms: Landmark[]): { ok:boolean; checks:CheckResult[]; angles:Angles } {
  const { s,e,w,h,k,a,score } = getBestSide(lms);
  const elbowAngle   = Math.round(angleDeg(s,e,w));
  const bodyAngle    = Math.round(angleDeg(s,h,a));
  const kneeAngle    = Math.round(angleDeg(h,k,a));
  const verticalSpan = Math.round(Math.abs(s.y-a.y)*100);
  const hipOffsetRaw = h.y - s.y;
  const hipOffsetPct = Math.round(hipOffsetRaw*100);
  const angles: Angles = { elbow:elbowAngle, body:bodyAngle, knee:kneeAngle,
                            hipOffset:hipOffsetPct, verticalSpan };
  if (score/6 < VIS_MIN) return { ok:false, angles, checks:[
    { label:"Visibility", pass:false, value:"body not in frame", hint:"Move back" }
  ]};
  const checks: CheckResult[] = [];
  const isHoriz = verticalSpan < HORIZONTAL_MAX*100;
  checks.push({ label:"Body flat",     pass:isHoriz,
    value:`span ${verticalSpan}%`, hint:isHoriz?"✓":"Lie flat" });
  const hipsOk  = Math.abs(hipOffsetRaw) < HIP_BAND;
  checks.push({ label:"Hips level",    pass:hipsOk,
    value:`offset ${hipOffsetPct>0?"+":""}${hipOffsetPct}%`,
    hint:hipOffsetRaw>HIP_BAND?"Hips too low":hipOffsetRaw<-HIP_BAND?"Hips too high":"✓" });
  const kneesOk = kneeAngle >= KNEE_STRAIGHT_MIN;
  checks.push({ label:"Legs straight", pass:kneesOk,
    value:`knee ${kneeAngle}°`, hint:kneesOk?"✓":"Lift knees" });
  const bodyOk = bodyAngle >= BODY_ANGLE_MIN;
  checks.push({ label:"Body straight", pass:bodyOk,
    value:`body ${bodyAngle}°`, hint:bodyOk?"✓":"Tighten core" });
  return { ok:isHoriz&&hipsOk&&kneesOk&&bodyOk, checks, angles };
}

function isStandingUp(lms: Landmark[]) {
  const { s,a } = getBestSide(lms);
  return (a.y-s.y) > STAND_UP_VERTICAL;
}

function speak(text: string, rate=1.0) {
  if (typeof window==="undefined"||!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate=rate; utt.pitch=1.05; utt.volume=1;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v=>
    v.name.toLowerCase().includes("male")||
    v.name.toLowerCase().includes("daniel")||
    v.name.toLowerCase().includes("alex")
  );
  if (preferred) utt.voice=preferred;
  window.speechSynthesis.speak(utt);
}

export default function BattleClient({ roomId }: Props) {
  const router   = useRouter();
  const playerId = getPlayerId();

  const videoRef      = useRef<HTMLVideoElement|null>(null);
  const canvasRef     = useRef<HTMLCanvasElement|null>(null);
  const streamRef     = useRef<MediaStream|null>(null);
  const landmarkerRef = useRef<PoseLandmarkerType|null>(null);
  const rafRef        = useRef<number|null>(null);

  const runningRef     = useRef(false);
  const lastDetectRef  = useRef(0);
  const fpsCntRef      = useRef(0);
  const lastFpsRef     = useRef(performance.now());
  const phaseRef       = useRef<PushupPhase>("no_plank");
  const posOkRef       = useRef(false);
  const posHoldRef     = useRef(0);
  const repCountRef    = useRef(0);
  const lastRepRef     = useRef(0);
  const screenRef      = useRef<AppScreen>("loading");
  const battleStartRef = useRef(0);
  const lastSyncedRef  = useRef(0);
  const isHostRef      = useRef(false);
  const endedRef       = useRef(false);

  const [screen,     setScreen]     = useState<AppScreen>("loading");
  const [fps,        setFps]        = useState(0);
  const [landmarks,  setLandmarks]  = useState(0);
  const [repCount,   setRepCount]   = useState(0);
  const [oppScore,   setOppScore]   = useState<number|null>(null);
  const [phase,      setPhase]      = useState<PushupPhase>("no_plank");
  const [positionOk, setPositionOk] = useState(false);
  const [checks,     setChecks]     = useState<CheckResult[]>([]);
  const [countdown,  setCountdown]  = useState(5);
  const [battleTime, setBattleTime] = useState(BATTLE_DURATION_SEC);
  const [posHoldPct, setPosHoldPct] = useState(0);
  const [finalReps,  setFinalReps]  = useState(0);
  const [finalOpp,   setFinalOpp]   = useState<number|null>(null);

  // ── MediaPipe ─────────────────────────────────────────────────────
  async function createLandmarker() {
    const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    const opts = {
      baseOptions:{ modelAssetPath:MODEL_PATH, delegate:"GPU" as const },
      runningMode:"VIDEO" as const, numPoses:1,
      minPoseDetectionConfidence:0.5, minPosePresenceConfidence:0.5,
      minTrackingConfidence:0.5, outputSegmentationMasks:false,
    };
    try   { return await PoseLandmarker.createFromOptions(vision, opts); }
    catch { return await PoseLandmarker.createFromOptions(vision,
              { ...opts, baseOptions:{ modelAssetPath:MODEL_PATH, delegate:"CPU" as const } }); }
  }

  async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video:{ width:{ideal:640}, height:{ideal:480},
              frameRate:{ideal:30,max:30}, facingMode:"user" },
      audio:false,
    });
    streamRef.current = stream;
    const video = videoRef.current;
    if (video) { video.srcObject=stream; await video.play(); }
    landmarkerRef.current = await createLandmarker();
    runningRef.current = true;
    loop();
  }

  // ── Sync score ───────────────────────────────────────────────────
  async function syncScore(reps: number) {
    if (reps === lastSyncedRef.current) return;
    lastSyncedRef.current = reps;
    const field = isHostRef.current ? "host_score" : "guest_score";
    await supabase.from("rooms").update({ [field]:reps }).eq("id", roomId);
  }

  // ── Screen transitions ───────────────────────────────────────────
  function beginCountdown() {
    screenRef.current = "countdown";
    setScreen("countdown");
    speak("Both players, get your ass into pushup position! Five...");
    let n=5; setCountdown(n);
    const tick = setInterval(()=>{
      n--; setCountdown(n);
      if (n>0) speak(String(n), 0.9);
      if (n<=0){ clearInterval(tick); speak("GO!",1.3); beginBattle(); }
    }, 1100);
  }

  function beginBattle() {
    screenRef.current      = "battle";
    battleStartRef.current = performance.now();
    phaseRef.current       = "no_plank";
    repCountRef.current    = 0;
    lastSyncedRef.current  = 0;
    endedRef.current       = false;
    setScreen("battle");
    setRepCount(0);
    setBattleTime(BATTLE_DURATION_SEC);
  }

  async function endBattle(forcedReps?: number, forcedOpp?: number|null) {
    if (endedRef.current) return;
    endedRef.current = true;

    const myReps   = forcedReps ?? repCountRef.current;
    const oppFinal = forcedOpp  ?? oppScore;

    screenRef.current = "results";
    setScreen("results");
    setFinalReps(myReps);
    setFinalOpp(oppFinal ?? null);
    window.speechSynthesis?.cancel();

    // Final sync to Supabase
    await syncScore(myReps);

    // Host writes final result
    if (isHostRef.current) {
      const { data } = await supabase
        .from("rooms").select("*").eq("id", roomId).single();
      if (data && data.status !== "finished") {
        const winnerId = data.host_score > data.guest_score ? data.host_id
                       : data.guest_score > data.host_score ? data.guest_id : null;
        await supabase.from("rooms")
          .update({ status:"finished", finished_at:new Date().toISOString() })
          .eq("id", roomId);
        await supabase.from("matches").insert({
          room_id:roomId, winner_id:winnerId,
          host_id:data.host_id, guest_id:data.guest_id,
          host_score:data.host_score, guest_score:data.guest_score,
          exercise:"pushups", duration_sec:BATTLE_DURATION_SEC,
        });
      }
    }

    if (myReps>=20)      speak(`BEAST MODE! ${myReps} reps!`,1.1);
    else if (myReps>=10) speak(`${myReps} reps! Not bad!`,1.0);
    else                 speak(`${myReps} reps. Run it back!`,0.95);
  }

  // ── Main init: read Supabase, determine correct screen ───────────
  // sessionStorage is NOT used — Supabase is the single source of truth
  useEffect(()=>{
    async function init() {
      const { data } = await supabase
        .from("rooms").select("*").eq("id", roomId).single();

      if (!data) { router.push("/"); return; }

      const room        = data as Room;
      isHostRef.current = room.host_id === playerId;
      const myScore     = isHostRef.current ? room.host_score  : room.guest_score;
      const oppScoreVal = isHostRef.current ? room.guest_score : room.host_score;

      // ── CASE 1: Battle already finished → show results, no camera
      if (room.status === "finished") {
        setFinalReps(myScore);
        setFinalOpp(oppScoreVal);
        setRepCount(myScore);
        setOppScore(oppScoreVal);
        repCountRef.current = myScore;
        screenRef.current   = "results";
        setScreen("results");
        return; // no camera needed
      }

      // ── CASE 2: Battle is live ───────────────────────────────────
      if (room.status === "battle") {
        // Check if this is a fresh arrival from lobby or a mid-battle refresh
        const isFresh = new URLSearchParams(window.location.search).get("fresh") === "1";

        if (isFresh) {
          // ── Fresh arrival from lobby → go through setup first ────
          // The lobby already ran the countdown — player needs to get
          // into position before reps count. Don't skip setup.
          setOppScore(oppScoreVal);
          screenRef.current = "setup";
          setScreen("setup");
          await startCamera();
          return;
        }

        // ── Genuine mid-battle refresh → restore and resume ──────
        repCountRef.current   = myScore;
        lastSyncedRef.current = myScore;
        setRepCount(myScore);
        setOppScore(oppScoreVal);

        if (room.started_at) {
          const elapsedMs  = Date.now() - new Date(room.started_at).getTime();
          const elapsedSec = elapsedMs / 1000;
          const remaining  = BATTLE_DURATION_SEC - elapsedSec;

          if (remaining <= 0) {
            // Time ran out while we were refreshing → results
            setFinalReps(myScore);
            setFinalOpp(oppScoreVal);
            screenRef.current = "results";
            setScreen("results");
            return;
          }

          // Rewind battle timer to correct remaining time
          battleStartRef.current = performance.now() - (elapsedSec * 1000);
          setBattleTime(Math.ceil(remaining));
        } else {
          battleStartRef.current = performance.now();
          setBattleTime(BATTLE_DURATION_SEC);
        }

        endedRef.current  = false;
        screenRef.current = "battle";
        setScreen("battle");
        await startCamera();
        return;
      }

      // ── CASE 3: Everything else → normal setup flow
      setOppScore(oppScoreVal);
      screenRef.current = "setup";
      setScreen("setup");
      await startCamera();
    }

    init();

    return ()=>{
      runningRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t=>t.stop());
      landmarkerRef.current?.close();
      window.speechSynthesis?.cancel();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime: opponent score + battle end ────────────────────────
  useEffect(()=>{
    const channel = supabase
      .channel(`battle:${roomId}`)
      .on("postgres_changes",{
        event:"UPDATE", schema:"public",
        table:"rooms", filter:`id=eq.${roomId}`,
      },(payload)=>{
        const updated  = payload.new as Room;
        const oppVal   = isHostRef.current ? updated.guest_score : updated.host_score;
        const myVal    = isHostRef.current ? updated.host_score  : updated.guest_score;
        setOppScore(oppVal);
        if (updated.status==="finished" && screenRef.current!=="results") {
          setFinalReps(myVal);
          setFinalOpp(oppVal);
          endBattle(myVal, oppVal);
        }
      })
      .subscribe();
    return ()=>{ supabase.removeChannel(channel); };
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pose processing ──────────────────────────────────────────────
  function processPose(lms: Landmark[]) {
    const result = checkPosition(lms);
    setChecks(result.checks);
    const wasOk = posOkRef.current;
    const nowOk = result.ok;
    posOkRef.current = nowOk;
    setPositionOk(nowOk);
    if (wasOk&&!nowOk){ phaseRef.current="no_plank"; setPhase("no_plank"); }

    const cur = screenRef.current;

    if (cur==="setup") {
      if (nowOk){ posHoldRef.current=Math.min(posHoldRef.current+1,POSITION_HOLD_FRAMES); }
      else      { posHoldRef.current=Math.max(posHoldRef.current-2,0); }
      setPosHoldPct(Math.round((posHoldRef.current/POSITION_HOLD_FRAMES)*100));
      if (posHoldRef.current>=POSITION_HOLD_FRAMES){ posHoldRef.current=0; beginCountdown(); }
      return;
    }

    if (cur==="battle") {
      const elapsed   = (performance.now()-battleStartRef.current)/1000;
      const remaining = Math.max(0, BATTLE_DURATION_SEC-elapsed);
      setBattleTime(Math.ceil(remaining));
      if (remaining<=0 && !endedRef.current){ endBattle(); return; }

      if (isStandingUp(lms)){
        if (phaseRef.current!=="no_plank"){ phaseRef.current="no_plank"; setPhase("no_plank"); }
        return;
      }
      if (wasOk&&!nowOk){ phaseRef.current="no_plank"; setPhase("no_plank"); return; }
      if (!nowOk) return;

      const eAngle = result.angles.elbow;
      const now    = performance.now();

      switch(phaseRef.current){
        case "no_plank":
          if (eAngle>=TOP_ELBOW){ phaseRef.current="top"; setPhase("top"); }
          break;
        case "top":
          if (eAngle<TOP_ELBOW-15){ phaseRef.current="descending"; setPhase("descending"); }
          break;
        case "descending":
          if (eAngle<=BOTTOM_ELBOW){ phaseRef.current="bottom"; setPhase("bottom"); }
          else if (eAngle>=TOP_ELBOW){ phaseRef.current="top"; setPhase("top"); }
          break;
        case "bottom":
          if (eAngle>BOTTOM_ELBOW+10){ phaseRef.current="ascending"; setPhase("ascending"); }
          break;
        case "ascending":
          if (eAngle>=TOP_ELBOW){
            if (now-lastRepRef.current>=MIN_REP_MS){
              repCountRef.current++;
              lastRepRef.current=now;
              setRepCount(repCountRef.current);
              if (repCountRef.current%SYNC_EVERY_N_REPS===0) syncScore(repCountRef.current);
            }
            phaseRef.current="top"; setPhase("top");
          } else if (eAngle<=BOTTOM_ELBOW){
            phaseRef.current="bottom"; setPhase("bottom");
          }
          break;
      }
    }
  }

  // ── Draw skeleton ────────────────────────────────────────────────
  function drawPose(lms: Landmark[], curPhase: PushupPhase, isOk: boolean) {
    const canvas=canvasRef.current; if (!canvas) return;
    const ctx=canvas.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if (!lms.length) return;
    const connections=[[11,12],[11,13],[13,15],[12,14],[14,16],
                       [11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
    const phaseColors: Record<PushupPhase,string>={
      no_plank:"#ff2244",top:"#00ff88",
      descending:"#ffcc00",bottom:"#ff6644",ascending:"#44aaff",
    };
    const color=isOk?phaseColors[curPhase]:"#ff2244";
    ctx.lineWidth=5; ctx.strokeStyle=color; ctx.fillStyle=isOk?"#ffffff":"#ff6666";
    for (const [si,ei] of connections){
      const a=lms[si],b=lms[ei]; if (!a||!b) continue;
      ctx.beginPath(); ctx.moveTo(a.x*canvas.width,a.y*canvas.height);
      ctx.lineTo(b.x*canvas.width,b.y*canvas.height); ctx.stroke();
    }
    for (const pt of lms){
      ctx.beginPath(); ctx.arc(pt.x*canvas.width,pt.y*canvas.height,5,0,Math.PI*2); ctx.fill();
    }
  }

  // ── rAF loop ─────────────────────────────────────────────────────
  const loop = useCallback(()=>{
    const video=videoRef.current, canvas=canvasRef.current, detector=landmarkerRef.current;
    if (!runningRef.current||!video||!canvas||!detector) return;
    if (video.videoWidth>0&&video.videoHeight>0){
      if (canvas.width!==video.videoWidth)   canvas.width=video.videoWidth;
      if (canvas.height!==video.videoHeight) canvas.height=video.videoHeight;
      const now=performance.now();
      if (now-lastDetectRef.current>=DETECTION_INTERVAL_MS){
        lastDetectRef.current=now;
        const cur=screenRef.current;
        if (cur==="results"||cur==="loading"||cur==="countdown"){
          rafRef.current=requestAnimationFrame(loop); return;
        }
        const result=detector.detectForVideo(video,now);
        const lms=(result.landmarks?.[0]??[]) as Landmark[];
        setLandmarks(lms.length);
        drawPose(lms,phaseRef.current,posOkRef.current);
        if (lms.length>0) processPose(lms);
        fpsCntRef.current++;
        const elapsed=now-lastFpsRef.current;
        if (elapsed>=1000){
          setFps(Math.round((fpsCntRef.current*1000)/elapsed));
          fpsCntRef.current=0; lastFpsRef.current=now;
        }
      }
    }
    rafRef.current=requestAnimationFrame(loop);
  },[]); // eslint-disable-line react-hooks/exhaustive-deps

  const phaseLabel: Record<PushupPhase,string>={
    no_plank:"Get in position",top:"DOWN ↓",
    descending:"Going down...",bottom:"PUSH UP ↑",ascending:"Almost there...",
  };
  const phaseColor: Record<PushupPhase,string>={
    no_plank:"#ff2244",top:"#00ff88",
    descending:"#ffcc00",bottom:"#ff6644",ascending:"#44aaff",
  };

  const didWin = finalOpp!==null
    ? finalReps>finalOpp
    : oppScore!==null ? repCount>oppScore : null;

  return (
    <div style={{
      position:"fixed",inset:0,background:"#060606",
      fontFamily:"'DM Mono','Courier New',monospace",
      overflow:"hidden",color:"white",
    }}>

      {/* LOADING */}
      {screen==="loading"&&(
        <div style={{
          position:"absolute",inset:0,display:"flex",
          alignItems:"center",justifyContent:"center",gap:12,
        }}>
          <div style={{width:8,height:8,borderRadius:"50%",background:"#00ff88"}}/>
          <span style={{opacity:0.5,fontSize:14}}>Loading match...</span>
        </div>
      )}

      {/* Video + canvas — only for setup/battle screens */}
      {(screen==="setup"||screen==="battle"||screen==="countdown")&&(
        <>
          <video ref={videoRef} playsInline muted autoPlay style={{
            position:"absolute",inset:0,width:"100%",height:"100%",
            objectFit:"cover",transform:"scaleX(-1)",
          }}/>
          <canvas ref={canvasRef} style={{
            position:"absolute",inset:0,width:"100%",height:"100%",
            transform:"scaleX(-1)",
          }}/>
          <div style={{
            position:"absolute",inset:0,pointerEvents:"none",
            background:"linear-gradient(to bottom,rgba(0,0,0,0.55) 0%,transparent 35%,transparent 60%,rgba(0,0,0,0.7) 100%)",
          }}/>
        </>
      )}

      {/* SETUP */}
      {screen==="setup"&&(
        <div style={{
          position:"absolute",inset:0,display:"flex",
          flexDirection:"column",justifyContent:"space-between",padding:20,
        }}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:22,fontWeight:900,letterSpacing:-1}}>
                LOCKED&apos;N<span style={{color:"#00ff88"}}>.</span>
              </div>
              <div style={{fontSize:11,opacity:0.4,marginTop:2}}>GET IN POSITION</div>
            </div>
            <div style={{
              padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:700,
              background:positionOk?"rgba(0,255,136,0.15)":"rgba(255,34,68,0.15)",
              border:`1px solid ${positionOk?"#00ff88":"#ff2244"}`,
              color:positionOk?"#00ff88":"#ff2244",
            }}>
              {positionOk?"● VALID":"● FIX POSITION"}
            </div>
          </div>
          <div style={{
            background:"rgba(0,0,0,0.7)",borderRadius:16,padding:16,
            backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{fontSize:11,opacity:0.4,letterSpacing:2,marginBottom:10}}>
              POSITION CHECK
            </div>
            {checks.map((c,i)=>(
              <div key={i} style={{
                display:"flex",alignItems:"center",gap:10,padding:"6px 0",
                borderBottom:i<checks.length-1?"1px solid rgba(255,255,255,0.06)":"none",
              }}>
                <span style={{fontSize:16}}>{c.pass?"✅":"❌"}</span>
                <span style={{fontSize:13,fontWeight:700,flex:1,
                              color:c.pass?"#00ff88":"#ff4466"}}>{c.label}</span>
                <span style={{fontSize:11,opacity:0.5}}>{c.value}</span>
              </div>
            ))}
            {checks.length===0&&(
              <div style={{opacity:0.4,fontSize:13,textAlign:"center",padding:"8px 0"}}>
                Point camera sideways at your full body
              </div>
            )}
            {positionOk&&(
              <div style={{marginTop:14}}>
                <div style={{
                  display:"flex",justifyContent:"space-between",
                  fontSize:11,opacity:0.6,marginBottom:6,
                }}>
                  <span>Hold position...</span><span>{posHoldPct}%</span>
                </div>
                <div style={{height:6,borderRadius:3,background:"rgba(255,255,255,0.1)",overflow:"hidden"}}>
                  <div style={{
                    height:"100%",borderRadius:3,width:`${posHoldPct}%`,
                    background:"linear-gradient(90deg,#00ff88,#00ccff)",transition:"width 0.15s",
                  }}/>
                </div>
                <div style={{fontSize:11,opacity:0.4,marginTop:6,textAlign:"center"}}>
                  Starting automatically...
                </div>
              </div>
            )}
          </div>
          <div style={{alignSelf:"flex-end",opacity:0.3,fontSize:11}}>
            {fps}fps · {landmarks}/33
          </div>
        </div>
      )}

      {/* COUNTDOWN */}
      {screen==="countdown"&&(
        <div style={{
          position:"absolute",inset:0,background:"rgba(0,0,0,0.85)",
          display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",gap:20,
        }}>
          <div style={{fontSize:14,letterSpacing:4,opacity:0.5,fontWeight:700}}>GET READY</div>
          <div style={{
            fontSize:countdown===0?80:140,fontWeight:900,letterSpacing:-6,lineHeight:1,
            color:countdown===0?"#00ff88":countdown<=2?"#ff6644":"white",
            textShadow:countdown===0?"0 0 60px #00ff8888":"none",transition:"all 0.15s",
          }}>
            {countdown===0?"GO!":countdown}
          </div>
          <div style={{fontSize:13,opacity:0.4}}>
            {countdown>0?`${BATTLE_DURATION_SEC}s pushup battle`:""}
          </div>
        </div>
      )}

      {/* BATTLE */}
      {screen==="battle"&&(
        <div style={{
          position:"absolute",inset:0,display:"flex",
          flexDirection:"column",justifyContent:"space-between",
        }}>
          <div style={{padding:"20px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{
                fontSize:100,fontWeight:900,lineHeight:0.9,letterSpacing:-5,
                color:"#00ff88",textShadow:"0 0 40px rgba(0,255,136,0.4)",
              }}>{repCount}</div>
              <div style={{fontSize:11,opacity:0.5,letterSpacing:2,marginTop:4}}>YOU</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{
                fontSize:52,fontWeight:900,letterSpacing:-2,lineHeight:1,
                color:battleTime<=10?"#ff6644":"white",
                textShadow:battleTime<=10?"0 0 20px rgba(255,100,68,0.5)":"none",
                transition:"color 0.3s",
              }}>{battleTime}</div>
              <div style={{fontSize:11,opacity:0.5,letterSpacing:2}}>SEC</div>
              {oppScore!==null&&(
                <div style={{marginTop:8,fontSize:13,opacity:0.7}}>
                  OPP: <span style={{color:"white",fontWeight:700}}>{oppScore}</span>
                </div>
              )}
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"center"}}>
            <div style={{
              padding:"6px 18px",borderRadius:30,fontSize:13,fontWeight:700,
              background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)",
              border:`1px solid ${phaseColor[phase]}55`,
              color:phaseColor[phase],letterSpacing:1,
            }}>{phaseLabel[phase]}</div>
          </div>
          <div style={{
            padding:"0 20px 28px",
            display:"flex",justifyContent:"space-between",alignItems:"flex-end",
          }}>
            <div style={{
              display:"flex",alignItems:"center",gap:6,
              padding:"6px 12px",borderRadius:20,
              background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)",
              border:`1px solid ${positionOk?"rgba(0,255,136,0.3)":"rgba(255,34,68,0.3)"}`,
              fontSize:12,fontWeight:700,color:positionOk?"#00ff88":"#ff2244",
            }}>
              <div style={{
                width:7,height:7,borderRadius:"50%",
                background:positionOk?"#00ff88":"#ff2244",
                boxShadow:positionOk?"0 0 6px #00ff88":"0 0 6px #ff2244",
              }}/>
              {positionOk?"COUNTING":"INVALID"}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{opacity:0.3,fontSize:11}}>{fps}fps</span>
              <button onClick={()=>endBattle()} style={{
                padding:"8px 16px",borderRadius:10,cursor:"pointer",
                border:"1px solid rgba(255,255,255,0.2)",
                background:"rgba(0,0,0,0.5)",color:"rgba(255,255,255,0.6)",
                fontSize:12,fontWeight:700,
              }}>END</button>
            </div>
          </div>
        </div>
      )}

      {/* RESULTS */}
      {screen==="results"&&(
        <div style={{
          position:"absolute",inset:0,
          background:"linear-gradient(160deg,#0a0a0a 0%,#0d1a0f 50%,#0a0a0a 100%)",
          display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",padding:24,
        }}>
          <div style={{fontSize:16,fontWeight:900,opacity:0.4,marginBottom:32}}>
            LOCKED&apos;N<span style={{color:"#00ff88"}}>.</span>
          </div>
          {didWin!==null&&(
            <div style={{
              fontSize:28,fontWeight:900,letterSpacing:2,marginBottom:20,
              color:didWin?"#00ff88":"#ff4466",
              textShadow:didWin?"0 0 30px #00ff8866":"0 0 30px #ff446644",
            }}>
              {didWin?"🏆 YOU WIN":"😤 YOU LOSE"}
            </div>
          )}
          <div style={{
            width:"100%",maxWidth:380,
            background:"rgba(255,255,255,0.04)",
            border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:24,overflow:"hidden",
          }}>
            <div style={{
              background:didWin
                ?"linear-gradient(90deg,#00ff8822,#00ccff22)"
                :"linear-gradient(90deg,#ff446622,#ff664422)",
              borderBottom:"1px solid rgba(255,255,255,0.08)",
              padding:"12px 20px",textAlign:"center",
              fontSize:12,fontWeight:700,letterSpacing:3,
              color:didWin===null?"white":didWin?"#00ff88":"#ff4466",
            }}>
              {didWin===null?"BATTLE COMPLETE":didWin?"🏆 WINNER":"GOOD FIGHT"}
            </div>
            <div style={{
              display:"grid",gridTemplateColumns:"1fr auto 1fr",
              alignItems:"center",padding:"28px 20px",
            }}>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:11,opacity:0.4,letterSpacing:2,marginBottom:8}}>YOU</div>
                <div style={{fontSize:72,fontWeight:900,letterSpacing:-4,
                             color:"#00ff88",lineHeight:1}}>{finalReps}</div>
                <div style={{fontSize:11,opacity:0.4,marginTop:4}}>REPS</div>
              </div>
              <div style={{padding:"8px 16px",fontSize:14,fontWeight:900,
                           opacity:0.25,letterSpacing:2}}>VS</div>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:11,opacity:0.4,letterSpacing:2,marginBottom:8}}>OPPONENT</div>
                <div style={{
                  fontSize:72,fontWeight:900,letterSpacing:-4,lineHeight:1,
                  color:finalOpp!==null?"rgba(255,255,255,0.8)":"rgba(255,255,255,0.2)",
                }}>
                  {finalOpp!==null?finalOpp:"—"}
                </div>
                <div style={{fontSize:11,opacity:0.4,marginTop:4}}>REPS</div>
              </div>
            </div>
            <div style={{
              display:"grid",gridTemplateColumns:"1fr 1fr 1fr",
              borderTop:"1px solid rgba(255,255,255,0.06)",
              padding:"14px 20px",
            }}>
              {[
                {label:"MY REPS", value:finalReps},
                {label:"DURATION",value:`${BATTLE_DURATION_SEC}s`},
                {label:"RPM",     value:Math.round((finalReps/BATTLE_DURATION_SEC)*60)},
              ].map((s,i)=>(
                <div key={i} style={{textAlign:"center"}}>
                  <div style={{fontSize:20,fontWeight:900,color:"white"}}>{s.value}</div>
                  <div style={{fontSize:9,opacity:0.35,letterSpacing:1,marginTop:2}}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{marginTop:24,fontSize:13,opacity:0.4,textAlign:"center",maxWidth:280}}>
            {finalReps>=20?"Absolute beast. Challenge someone now.":
             finalReps>=10?"Solid. You got more in the tank.":
             "Every rep counts. Run it back."}
          </div>
          <div style={{display:"flex",gap:12,marginTop:28,width:"100%",maxWidth:380}}>
            <button onClick={()=>router.push(`/room/${roomId}`)} style={{
              flex:1,padding:"16px 0",borderRadius:14,border:0,
              background:"#00ff88",color:"#000",
              fontSize:15,fontWeight:900,cursor:"pointer",
            }}>REMATCH 🔥</button>
            <button onClick={()=>{
              if (navigator.share) navigator.share({
                title:"Locked'N",
                text:`Just hit ${finalReps} pushups in ${BATTLE_DURATION_SEC}s on Locked'N 💪`,
                url:window.location.href,
              });
            }} style={{
              padding:"16px 18px",borderRadius:14,cursor:"pointer",
              border:"1px solid rgba(255,255,255,0.15)",
              background:"transparent",color:"white",
              fontSize:15,fontWeight:700,
            }}>SHARE</button>
          </div>
        </div>
      )}
    </div>
  );
}
