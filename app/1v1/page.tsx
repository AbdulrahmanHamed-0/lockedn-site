"use client";
import { useRouter } from "next/navigation";
import PoseTestClient from "../../components/one-v-one/PoseTestClient";

export default function OneVOnePage() {
  const router = useRouter();
  const createRoom = () => {
    const roomId = Math.random().toString(36).slice(2, 10);
    router.push(`/room/${roomId}`);
  };
  return (
    <div>
      <div style={{ position: "fixed", top: 10, right: 10, zIndex: 999 }}>
        <button onClick={createRoom} style={{
          padding: "10px 16px", borderRadius: 10, background: "#00ff88",
          color: "#000", fontWeight: 800, border: 0, cursor: "pointer", fontSize: 13,
        }}>
          1v1 WITH FRIEND
        </button>
      </div>
      <PoseTestClient />
    </div>
  );
}
