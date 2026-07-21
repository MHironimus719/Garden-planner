import { redirect } from "next/navigation";
import { getSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  let hasZone = false;
  try {
    const settings = await getSettings();
    hasZone = Boolean(settings?.zone);
  } catch {
    // DB not reachable/configured yet — the setup wizard explains what to do.
  }
  redirect(hasZone ? "/today" : "/setup");
}
