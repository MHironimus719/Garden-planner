import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const due = request.nextUrl.searchParams.get("due") ?? "all";
  const today = new Date().toISOString().slice(0, 10);

  let q = db().from("tasks").select("*").order("due_start");
  if (due === "today") {
    q = q.is("done_at", null).lte("due_start", today);
  } else if (due === "week") {
    const weekOut = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    q = q.is("done_at", null).lte("due_start", weekOut);
  } else if (due === "open") {
    q = q.is("done_at", null);
  }
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
