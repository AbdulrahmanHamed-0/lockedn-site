import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// ── Types matching our DB schema ───────────────────────────────────
export type RoomStatus =
  | "waiting"     // host created, waiting for guest
  | "ready"       // guest joined, both in lobby
  | "countdown"   // both hit ready, counting down
  | "battle"      // fight is live
  | "finished";   // match over

export interface Room {
  id:           string;
  host_id:      string;
  guest_id:     string | null;
  status:       RoomStatus;
  host_ready:   boolean;
  guest_ready:  boolean;
  host_score:   number;
  guest_score:  number;
  exercise:     string;
  duration_sec: number;
  created_at:   string;
  started_at:   string | null;
  finished_at:  string | null;
}

export interface Signal {
  id:         number;
  room_id:    string;
  from_id:    string;
  to_id:      string;
  type:       "offer" | "answer" | "ice";
  payload:    Record<string, unknown>;
  created_at: string;
}

// ── Helper: generate a random player ID (stored in sessionStorage) ─
// We don't have auth yet so we use a random ID per session.
export function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  const key = "lockedn_player_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = "p_" + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem(key, id);
  }
  return id;
}
