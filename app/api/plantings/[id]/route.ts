import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if ("removed_date" in body) updates.removed_date = body.removed_date;
  if ("notes" in body) updates.notes = body.notes;
  if ("variety" in body) updates.variety = body.variety;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }
  const { data, error } = await db().from("plantings").update(updates).eq("id", Number(id)).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// Hard delete, for data-entry mistakes. Normal end-of-life is PATCH removed_date,
// which keeps the planting in the bed's history.
export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = db();
  // Detach dependent rows first (no cascade in the schema); keep the events themselves.
  await supabase.from("events").update({ planting_id: null }).eq("planting_id", Number(id));
  await supabase.from("tasks").update({ planting_id: null }).eq("planting_id", Number(id));
  const { error } = await supabase.from("plantings").delete().eq("id", Number(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
