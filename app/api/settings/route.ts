import { NextRequest, NextResponse } from "next/server";
import { db, getSettings } from "@/lib/db";

export async function GET() {
  try {
    return NextResponse.json(await getSettings());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const updates: Record<string, unknown> = { id: 1, updated_at: new Date().toISOString() };
  for (const key of ["zip", "zone", "last_frost", "first_frost"]) {
    if (key in body) updates[key] = body[key];
  }
  const { data, error } = await db().from("settings").upsert(updates).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
