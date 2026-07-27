import { NextRequest, NextResponse } from "next/server";
import { getDailySuggestions } from "@/lib/suggestions";

export const maxDuration = 120;

// Vercel Cron hits this every morning (see vercel.json). The proxy lets
// /api/cron/ through without a session; CRON_SECRET is the auth instead.
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const suggestions = await getDailySuggestions(true);
    return NextResponse.json({ ok: true, count: suggestions.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
