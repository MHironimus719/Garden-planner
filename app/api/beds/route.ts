import { NextResponse } from "next/server";
import { listBeds } from "@/lib/db";

export async function GET() {
  try {
    return NextResponse.json(await listBeds());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
