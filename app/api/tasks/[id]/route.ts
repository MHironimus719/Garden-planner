import { NextRequest, NextResponse } from "next/server";
import { db, Task } from "@/lib/db";

// Toggling a 'plant' task to done also inserts the planting row (source 'plan'),
// so bed state reflects what the gardener actually did.
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { done } = await request.json();
  const taskId = Number(id);

  const { data: task, error: fetchErr } = await db().from("tasks").select("*").eq("id", taskId).single();
  if (fetchErr || !task) return NextResponse.json({ error: fetchErr?.message ?? "not found" }, { status: 404 });
  const t = task as Task;

  const done_at = done ? new Date().toISOString() : null;
  const updates: Record<string, unknown> = { done_at };

  if (done && t.type === "plant" && t.bed_id && t.crop && !t.planting_id) {
    const { data: planting } = await db()
      .from("plantings")
      .insert({
        bed_id: t.bed_id,
        crop: t.crop,
        planted_date: new Date().toISOString().slice(0, 10),
        source: "plan",
      })
      .select()
      .single();
    if (planting) updates.planting_id = planting.id;
  }

  const { data, error } = await db().from("tasks").update(updates).eq("id", taskId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
