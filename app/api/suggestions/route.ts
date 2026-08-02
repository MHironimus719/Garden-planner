import { NextRequest, NextResponse } from "next/server";
import { getDailySuggestions, peekDailySuggestions } from "@/lib/suggestions";

export const maxDuration = 120;

// GET: today's briefing if it exists (fast, no AI call)
export async function GET() {
  try {
    return NextResponse.json({ suggestions: await peekDailySuggestions() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST: generate today's briefing now (lazy fallback when the cron hasn't run).
// { force: true } regenerates even if one exists — for the card's refresh button.
export async function POST(request: NextRequest) {
  const { force } = await request.json().catch(() => ({ force: false }));
  try {
    return NextResponse.json({ suggestions: await getDailySuggestions(Boolean(force)) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
