import { NextRequest, NextResponse } from "next/server";
import { db, getActiveSeason } from "@/lib/db";

export async function GET() {
  try {
    return NextResponse.json(await getActiveSeason());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// Mark the current active/planning season done ("start new season" in Settings).
export async function PATCH(request: NextRequest) {
  const { action } = await request.json();
  if (action !== "finish") {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
  const { error } = await db().from("seasons").update({ status: "done" }).in("status", ["planning", "active"]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
