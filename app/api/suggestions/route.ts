import { NextResponse } from "next/server";
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

// POST: generate today's briefing now (lazy fallback when the cron hasn't run)
export async function POST() {
  try {
    return NextResponse.json({ suggestions: await getDailySuggestions() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
