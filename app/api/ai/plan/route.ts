import { NextRequest, NextResponse } from "next/server";
import { anthropic, MODEL } from "@/lib/anthropic";
import { seasonPlanZ, seasonPlanJsonSchema } from "@/lib/schemas";
import { gardenContext, planSystemPrompt } from "@/lib/prompts";
import { db } from "@/lib/db";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const { seasonLabel, desiredCrops, notes } = await request.json();
  if (!seasonLabel || !Array.isArray(desiredCrops) || desiredCrops.length === 0) {
    return NextResponse.json({ error: "seasonLabel and desiredCrops required" }, { status: 400 });
  }

  const context = await gardenContext();
  const userMsg = [
    `Season: ${seasonLabel}.`,
    `Crops I want to grow: ${desiredCrops.join(", ")}.`,
    notes ? `Additional notes: ${notes}` : "",
    `Assign these crops to my beds. Cover every bed.`,
  ]
    .filter(Boolean)
    .join("\n");

  const stream = anthropic().messages.stream({
    model: MODEL,
    max_tokens: 32000,
    system: planSystemPrompt(context),
    output_config: { format: { type: "json_schema", schema: seasonPlanJsonSchema } },
    messages: [{ role: "user", content: userMsg }],
  });
  const response = await stream.finalMessage();

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) return NextResponse.json({ error: "no plan from model" }, { status: 502 });
  const parsed = seasonPlanZ.safeParse(JSON.parse(text));
  if (!parsed.success) return NextResponse.json({ error: "bad plan output" }, { status: 502 });

  // One draft at a time: replace any existing 'planning' season with this one.
  await db().from("seasons").delete().eq("status", "planning");
  const { data: season, error } = await db()
    .from("seasons")
    .insert({
      year: new Date().getFullYear(),
      label: seasonLabel,
      status: "planning",
      plan_json: parsed.data,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ seasonId: season.id, plan: parsed.data });
}
