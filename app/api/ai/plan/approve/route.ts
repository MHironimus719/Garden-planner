import { NextRequest, NextResponse } from "next/server";
import { anthropic, MODEL } from "@/lib/anthropic";
import { seasonPlanZ, taskScheduleZ, taskScheduleJsonSchema } from "@/lib/schemas";
import { gardenContext, taskSystemPrompt } from "@/lib/prompts";
import { db } from "@/lib/db";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const { seasonId, plan } = await request.json();
  const parsedPlan = seasonPlanZ.safeParse(plan);
  if (!seasonId || !parsedPlan.success) {
    return NextResponse.json({ error: "seasonId and a valid plan required" }, { status: 400 });
  }

  // 1. Save the (possibly user-edited) plan and activate the season.
  const { error: seasonErr } = await db()
    .from("seasons")
    .update({ plan_json: parsedPlan.data, status: "active" })
    .eq("id", seasonId);
  if (seasonErr) return NextResponse.json({ error: seasonErr.message }, { status: 500 });

  // 2. Generate the week-by-week task schedule for the approved plan.
  const context = await gardenContext();
  const planText = parsedPlan.data.beds
    .map((b) => {
      const crops = b.assignments.map((a) => `${a.crop} (${a.family})`).join(", ") || "resting";
      return `- Bed id ${b.bed_id} (${b.bed_name}): ${crops}`;
    })
    .join("\n");

  const stream = anthropic().messages.stream({
    model: MODEL,
    max_tokens: 64000,
    system: taskSystemPrompt(context),
    output_config: { format: { type: "json_schema", schema: taskScheduleJsonSchema } },
    messages: [
      {
        role: "user",
        content: `Approved plan:\n${planText}\n\nGenerate the full season task schedule (planting, fertilizing, harvest windows, removals).`,
      },
    ],
  });
  const response = await stream.finalMessage();

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) return NextResponse.json({ error: "no schedule from model" }, { status: 502 });
  const parsed = taskScheduleZ.safeParse(JSON.parse(text));
  if (!parsed.success) return NextResponse.json({ error: "bad schedule output" }, { status: 502 });

  const rows = parsed.data.tasks.map((t) => ({
    season_id: seasonId,
    bed_id: t.bed_id,
    type: t.type,
    title: t.title,
    details: t.details,
    crop: t.crop,
    due_start: t.due_start,
    due_end: t.due_end,
  }));
  const { error: taskErr } = await db().from("tasks").insert(rows);
  if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, taskCount: rows.length });
}
