import { anthropic, MODEL } from "./anthropic";
import { suggestionsZ, suggestionsJsonSchema, Suggestion } from "./schemas";
import { gardenContext, suggestionsSystemPrompt } from "./prompts";
import { db } from "./db";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Returns today's briefing, generating and storing it if it doesn't exist yet.
// Called by the morning cron and lazily by the Today tab as a fallback.
export async function getDailySuggestions(force = false): Promise<Suggestion[]> {
  const forDate = today();

  if (!force) {
    const { data } = await db().from("suggestions").select("items").eq("for_date", forDate).maybeSingle();
    if (data) return data.items as Suggestion[];
  }

  const context = await gardenContext({ includeOpenTasks: true });
  const response = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: suggestionsSystemPrompt(context),
    output_config: { format: { type: "json_schema", schema: suggestionsJsonSchema } },
    messages: [{ role: "user", content: `Write today's briefing (${forDate}).` }],
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("no suggestions from model");
  const parsed = suggestionsZ.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error("bad suggestions output");

  const { error } = await db()
    .from("suggestions")
    .upsert({ for_date: forDate, items: parsed.data.suggestions }, { onConflict: "for_date" });
  if (error && !/suggestions.*(does not exist|schema cache)/i.test(error.message)) {
    throw new Error(error.message);
  }
  return parsed.data.suggestions;
}

// Today's stored briefing, or null if not generated yet (never generates).
export async function peekDailySuggestions(): Promise<Suggestion[] | null> {
  const { data } = await db().from("suggestions").select("items").eq("for_date", today()).maybeSingle();
  return (data?.items as Suggestion[]) ?? null;
}
