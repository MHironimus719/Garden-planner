import { NextRequest, NextResponse } from "next/server";
import { db, listPlantings } from "@/lib/db";

export async function GET(request: NextRequest) {
  const bedId = request.nextUrl.searchParams.get("bed");
  const currentOnly = request.nextUrl.searchParams.get("current") === "1";
  try {
    const plantings = await listPlantings({
      bedId: bedId ? Number(bedId) : undefined,
      currentOnly,
    });
    return NextResponse.json(plantings);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { bed_id, crop, variety, family, planted_date, notes } = body;
  if (!bed_id || !crop || !planted_date) {
    return NextResponse.json({ error: "bed_id, crop, planted_date required" }, { status: 400 });
  }
  const { data, error } = await db()
    .from("plantings")
    .insert({
      bed_id,
      crop,
      variety: variety || null,
      family: family || null,
      planted_date,
      notes: notes || null,
      source: "manual",
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
