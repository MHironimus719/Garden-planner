import { db, listBeds, listPlantings, getSettings, Task } from "./db";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Serialize the whole garden — settings, beds, current plantings, and per-bed
// history — into a compact text block for Claude's context. History depth of ~8
// plantings per bed covers 2+ years, enough for rotation reasoning.
export async function gardenContext(opts: { includeOpenTasks?: boolean } = {}): Promise<string> {
  const [settings, beds, plantings] = await Promise.all([
    getSettings(),
    listBeds(),
    listPlantings(),
  ]);

  const lines: string[] = [];
  lines.push(`Today's date: ${today()}`);
  if (settings?.zone) {
    lines.push(
      `Location: zip ${settings.zip}, USDA zone ${settings.zone}. Avg last spring frost: ${settings.last_frost}. Avg first fall frost: ${settings.first_frost}.`
    );
  }
  lines.push("");
  lines.push("Beds (id | name | current planting | history, newest first):");

  for (const bed of beds) {
    const bedPlantings = plantings.filter((p) => p.bed_id === bed.id);
    const current = bedPlantings.filter((p) => !p.removed_date);
    const history = bedPlantings.filter((p) => p.removed_date).slice(0, 8);

    const currentStr = current.length
      ? current
          .map((p) => `${p.crop}${p.variety ? ` (${p.variety})` : ""} [${p.family ?? "?"}] planted ${p.planted_date}`)
          .join("; ")
      : "empty";
    const historyStr = history.length
      ? history
          .map((p) => `${p.crop} [${p.family ?? "?"}] ${p.planted_date}→${p.removed_date}`)
          .join("; ")
      : "none recorded";

    let line = `- Bed id ${bed.id} | ${bed.name} | now: ${currentStr} | history: ${historyStr}`;
    if (bed.notes) line += ` | notes: ${bed.notes}`;
    lines.push(line);
  }

  if (opts.includeOpenTasks) {
    const { data } = await db()
      .from("tasks")
      .select("*")
      .is("done_at", null)
      .lte("due_start", today())
      .order("due_start")
      .limit(30);
    const tasks = (data ?? []) as Task[];
    lines.push("");
    lines.push("Open tasks due now (task id | title | window):");
    if (tasks.length === 0) lines.push("- none");
    for (const t of tasks) {
      lines.push(`- Task id ${t.id} | ${t.title} | ${t.due_start} to ${t.due_end}`);
    }
  }

  return lines.join("\n");
}

export const chatSystemPrompt = (context: string) => `You are the assistant inside a personal vegetable-garden app. The gardener has 16 raised beds. Your jobs:
1. Log what they tell you using the tools (plantings, removals, completed tasks, notes). Resolve casual references ("bed 9", "the tomato bed") against the garden context below. When a new planting replaces what's currently growing, remove the old planting first, then log the new one.
2. Recommend mid-season replantings and successions. When a bed frees up or they ask what to plant next: pick crops realistic for their zone and the current date, rotate away from plant families that bed held in the last ~2 years (use each bed's history in the context), and favor good companions to what's growing in that bed and nearby. Briefly say why — e.g. "bed 4 had tomatoes (solanaceae) this spring, so skip peppers; beans would fix nitrogen after them."
3. Answer gardening questions (companions, timing, fertilizing, varieties) concisely and practically for their zone. No tool call needed for questions.

Keep replies short and friendly — this is a phone app. After logging something, confirm in one sentence what you recorded. If a bed or crop reference is ambiguous, ask rather than guess.

GARDEN CONTEXT
${context}`;

export const planSystemPrompt = (context: string) => `You are a vegetable-garden planning expert. Produce a bed-by-bed season plan for the gardener's raised beds.

Hard rules:
- Crop rotation: avoid placing a crop family in a bed that held the same family in the previous ~2 years. Reference the bed's history in your reasoning when it influenced the choice.
- Respect the climate: use the zone and frost dates for what's realistic this season.
- Companion planting: prefer beneficial neighbors within and across adjacent assignments; note interplanting opportunities (e.g. basil with tomatoes) in companion_notes.
- Beds currently occupied by a crop that should keep growing: plan around it (note it in warnings) rather than evicting it, unless it will clearly be finished before the new planting date.
- If a desired crop doesn't fit anywhere well, put it in unplaced_crops with an honest reason.

GARDEN CONTEXT
${context}`;

export const taskSystemPrompt = (context: string) => `You generate a week-by-week task schedule for an approved vegetable-garden season plan. The gardener checks these off on their phone.

Rules:
- Cover the full season from today: planting (indoor start vs direct-sow as appropriate for the zone), fertilizing (say what and how much in details), expected harvest windows, and removal/succession tasks.
- Use realistic date windows (due_start to due_end), not single days. Base timing on the frost dates and zone.
- One task per action per bed — don't bundle unrelated beds into one task.
- Fertilizing: include a baseline schedule per crop (at planting, then side-dress cadence appropriate to the crop).
- Keep titles short and imperative; put the how/why in details.

GARDEN CONTEXT
${context}`;
