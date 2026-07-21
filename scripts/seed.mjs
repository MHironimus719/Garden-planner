// Verifies the Supabase connection and optionally seeds demo data so the AI
// planner has rotation history to reason about.
//   node scripts/seed.mjs          → check connection + bed count
//   node scripts/seed.mjs --demo   → also insert two prior seasons of plantings
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Minimal .env.local loader (no dotenv dependency)
try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {
  /* .env.local optional if vars already set */
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const { data: beds, error } = await db.from("beds").select("*").order("position");
if (error) {
  console.error("Connection failed:", error.message);
  console.error("Did you run scripts/schema.sql in the Supabase SQL editor?");
  process.exit(1);
}
console.log(`Connected. ${beds.length} beds found.`);

if (process.argv.includes("--demo")) {
  const year = new Date().getFullYear();
  const demo = [
    // Two prior seasons across families so rotation logic is testable
    { bed: 1, crop: "tomatoes", family: "solanaceae", planted: `${year - 1}-04-10`, removed: `${year - 1}-08-20` },
    { bed: 1, crop: "broccoli", family: "brassicaceae", planted: `${year - 2}-09-15`, removed: `${year - 1}-01-10` },
    { bed: 2, crop: "green beans", family: "fabaceae", planted: `${year - 1}-04-05`, removed: `${year - 1}-07-15` },
    { bed: 3, crop: "peppers", family: "solanaceae", planted: `${year - 1}-04-15`, removed: `${year - 1}-09-30` },
    { bed: 4, crop: "squash", family: "cucurbitaceae", planted: `${year - 1}-05-01`, removed: `${year - 1}-08-01` },
    { bed: 5, crop: "carrots", family: "apiaceae", planted: `${year - 1}-03-01`, removed: `${year - 1}-06-01` },
    { bed: 6, crop: "onions", family: "alliaceae", planted: `${year - 1}-02-15`, removed: `${year - 1}-06-20` },
    { bed: 7, crop: "lettuce", family: "asteraceae", planted: `${year - 1}-03-10`, removed: `${year - 1}-05-15` },
  ];
  const rows = demo.map((d) => ({
    bed_id: d.bed,
    crop: d.crop,
    family: d.family,
    planted_date: d.planted,
    removed_date: d.removed,
    source: "manual",
  }));
  const { error: insErr } = await db.from("plantings").insert(rows);
  if (insErr) {
    console.error("Demo insert failed:", insErr.message);
    process.exit(1);
  }
  console.log(`Inserted ${rows.length} demo historical plantings.`);
}
