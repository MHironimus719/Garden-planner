import { NextRequest, NextResponse } from "next/server";
import { anthropic, MODEL } from "@/lib/anthropic";
import { zoneLookupZ, zoneLookupJsonSchema } from "@/lib/schemas";
import { db } from "@/lib/db";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { zip } = await request.json();
  if (!zip || typeof zip !== "string") {
    return NextResponse.json({ error: "zip required" }, { status: 400 });
  }

  const year = new Date().getFullYear();
  const response = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 2048,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: zoneLookupJsonSchema },
    },
    messages: [
      {
        role: "user",
        content: `What is the USDA hardiness zone and the average last spring frost / first fall frost dates for US zip code ${zip}? Use ${year} for the dates.`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) return NextResponse.json({ error: "no answer from model" }, { status: 502 });

  const parsed = zoneLookupZ.safeParse(JSON.parse(text));
  if (!parsed.success) return NextResponse.json({ error: "bad model output" }, { status: 502 });

  const { zone, last_frost, first_frost, confidence_note } = parsed.data;
  const { error } = await db().from("settings").upsert({
    id: 1,
    zip,
    zone,
    last_frost,
    first_frost,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ zip, zone, last_frost, first_frost, confidence_note });
}
