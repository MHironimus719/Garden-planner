import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type Settings = {
  id: number;
  zip: string | null;
  zone: string | null;
  last_frost: string | null;
  first_frost: string | null;
  updated_at: string;
};

export type Bed = {
  id: number;
  name: string;
  position: number;
  notes: string | null;
};

export type PlantingSource = "manual" | "chat" | "plan";

export type Planting = {
  id: number;
  bed_id: number;
  crop: string;
  variety: string | null;
  family: string | null;
  planted_date: string;
  removed_date: string | null;
  source: PlantingSource;
  notes: string | null;
};

export type SeasonStatus = "planning" | "active" | "done";

export type Season = {
  id: number;
  year: number;
  label: string;
  status: SeasonStatus;
  plan_json: unknown | null;
  created_at: string;
};

export type TaskType = "plant" | "fertilize" | "harvest" | "remove" | "water" | "other";

export type Task = {
  id: number;
  season_id: number | null;
  bed_id: number | null;
  planting_id: number | null;
  type: TaskType;
  title: string;
  details: string | null;
  crop: string | null;
  due_start: string;
  due_end: string;
  done_at: string | null;
};

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  tool_calls: unknown | null;
  created_at: string;
};

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    }
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export async function getSettings(): Promise<Settings | null> {
  const { data, error } = await db().from("settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function listBeds(): Promise<Bed[]> {
  const { data, error } = await db().from("beds").select("*").order("position");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listPlantings(opts: { bedId?: number; currentOnly?: boolean } = {}): Promise<Planting[]> {
  let q = db().from("plantings").select("*").order("planted_date", { ascending: false });
  if (opts.bedId) q = q.eq("bed_id", opts.bedId);
  if (opts.currentOnly) q = q.is("removed_date", null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getActiveSeason(): Promise<Season | null> {
  const { data, error } = await db()
    .from("seasons")
    .select("*")
    .in("status", ["planning", "active"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
