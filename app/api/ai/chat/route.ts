import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "@/lib/anthropic";
import { chatTools } from "@/lib/schemas";
import { gardenContext, chatSystemPrompt } from "@/lib/prompts";
import { db } from "@/lib/db";

export const maxDuration = 120;

type ToolAction = { tool: string; input: Record<string, unknown>; result: string };

// The model occasionally emits markup artifacts in string fields — strip
// tags and collapse whitespace on every tool input so junk never reaches the DB.
function cleanInput(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = typeof v === "string" ? v.replace(/<[^>]*>?/g, "").replace(/\s+/g, " ").trim() : v;
  }
  return out;
}

async function executeTool(name: string, rawInput: Record<string, unknown>): Promise<string> {
  const supabase = db();
  const input = cleanInput(rawInput);
  try {
    if (name === "log_planting") {
      const { error } = await supabase.from("plantings").insert({
        bed_id: input.bed_id,
        crop: input.crop,
        variety: input.variety || null,
        family: input.family || null,
        planted_date: input.planted_date,
        source: "chat",
      });
      if (error) throw new Error(error.message);
      return `Logged: ${input.crop} planted in bed ${input.bed_id} on ${input.planted_date}.`;
    }
    if (name === "remove_planting") {
      const { data, error } = await supabase
        .from("plantings")
        .select("id, crop")
        .eq("bed_id", input.bed_id)
        .is("removed_date", null)
        .ilike("crop", `%${input.crop}%`);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) return `No current planting matching "${input.crop}" in bed ${input.bed_id}.`;
      const ids = data.map((p) => p.id);
      const { error: updErr } = await supabase
        .from("plantings")
        .update({ removed_date: input.removed_date })
        .in("id", ids);
      if (updErr) throw new Error(updErr.message);
      return `Marked ${data.map((p) => p.crop).join(", ")} removed from bed ${input.bed_id}.`;
    }
    if (name === "log_event") {
      const crop = String(input.crop ?? "");
      const details = String(input.details ?? "");
      // Link to the current planting of that crop when there is one, so events
      // survive as history after the planting is closed out.
      let plantingId: number | null = null;
      if (crop) {
        const { data } = await supabase
          .from("plantings")
          .select("id")
          .eq("bed_id", input.bed_id)
          .is("removed_date", null)
          .ilike("crop", `%${crop}%`)
          .limit(1);
        plantingId = data?.[0]?.id ?? null;
      }
      const { error } = await supabase.from("events").insert({
        bed_id: input.bed_id,
        planting_id: plantingId,
        type: input.type,
        event_date: input.event_date,
        crop: crop || null,
        details: details || null,
      });
      if (error) {
        if (/events.*(does not exist|schema cache)/i.test(error.message)) {
          throw new Error(
            "The events table doesn't exist yet — paste the updated scripts/schema.sql into the Supabase SQL editor and run it."
          );
        }
        throw new Error(error.message);
      }
      let msg = `Logged ${input.type} for bed ${input.bed_id} on ${input.event_date}.`;
      if (input.type === "harvest" && input.final_harvest && plantingId) {
        const { error: closeErr } = await supabase
          .from("plantings")
          .update({ removed_date: input.event_date })
          .eq("id", plantingId);
        if (!closeErr) msg += " Final harvest — planting closed out.";
      }
      return msg;
    }
    if (name === "complete_task") {
      const { error } = await supabase
        .from("tasks")
        .update({ done_at: new Date().toISOString() })
        .eq("id", input.task_id);
      if (error) throw new Error(error.message);
      return `Task ${input.task_id} marked done.`;
    }
    if (name === "add_note") {
      const { data: bed, error } = await supabase.from("beds").select("notes").eq("id", input.bed_id).single();
      if (error) throw new Error(error.message);
      const stamp = new Date().toISOString().slice(0, 10);
      const notes = bed.notes ? `${bed.notes}\n${stamp}: ${input.text}` : `${stamp}: ${input.text}`;
      const { error: updErr } = await supabase.from("beds").update({ notes }).eq("id", input.bed_id);
      if (updErr) throw new Error(updErr.message);
      return `Note added to bed ${input.bed_id}.`;
    }
    return `Unknown tool ${name}`;
  } catch (e) {
    return `Error: ${(e as Error).message}`;
  }
}

export async function GET() {
  const { data, error } = await db()
    .from("chat_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json((data ?? []).reverse());
}

export async function POST(request: NextRequest) {
  const { message } = await request.json();
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const [context, historyRes] = await Promise.all([
    gardenContext({ includeOpenTasks: true }),
    db().from("chat_log").select("role, content").order("created_at", { ascending: false }).limit(10),
  ]);
  const history = (historyRes.data ?? []).reverse();

  const messages: Anthropic.Messages.MessageParam[] = [
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: message },
  ];

  await db().from("chat_log").insert({ role: "user", content: message });

  const actions: ToolAction[] = [];
  let replyText = "";

  // Small manual tool loop; the model rarely needs more than 2 rounds.
  for (let i = 0; i < 4; i++) {
    const response = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: chatSystemPrompt(context),
      tools: chatTools as Anthropic.Messages.Tool[],
      messages,
    });

    if (response.stop_reason !== "tool_use") {
      replyText = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      break;
    }

    messages.push({ role: "assistant", content: response.content });
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const input = block.input as Record<string, unknown>;
      const result = await executeTool(block.name, input);
      actions.push({ tool: block.name, input, result });
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
    }
    messages.push({ role: "user", content: toolResults });
  }

  if (!replyText) replyText = actions.length ? actions.map((a) => a.result).join(" ") : "Sorry, I didn't catch that.";

  await db().from("chat_log").insert({
    role: "assistant",
    content: replyText,
    tool_calls: actions.length ? actions : null,
  });

  return NextResponse.json({ reply: replyText, actions });
}
