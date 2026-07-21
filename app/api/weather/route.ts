import { NextResponse } from "next/server";
import { getSettings } from "@/lib/db";
import { getWeather } from "@/lib/weather";

export const maxDuration = 30;

export async function GET() {
  const settings = await getSettings().catch(() => null);
  const zip = settings?.zip;
  if (!zip) return NextResponse.json({ error: "Set a zip code in Settings first" }, { status: 400 });

  try {
    return NextResponse.json(await getWeather(zip));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
