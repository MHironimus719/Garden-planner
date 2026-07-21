import { z } from "zod";

// Zod validators (runtime parse) + hand-written JSON Schemas for Claude structured
// outputs. Structured outputs require additionalProperties:false and every property
// listed in `required`, and don't support min/max constraints — keep the two in sync.

// ---------- Zip → zone/frost lookup ----------

export const zoneLookupZ = z.object({
  zone: z.string(),
  last_frost: z.string(), // YYYY-MM-DD, typical date for the current year
  first_frost: z.string(),
  confidence_note: z.string(),
});
export type ZoneLookup = z.infer<typeof zoneLookupZ>;

export const zoneLookupJsonSchema = {
  type: "object",
  properties: {
    zone: { type: "string", description: "USDA hardiness zone, e.g. '8b'. For frost-free tropical climates use the zone number anyway." },
    last_frost: { type: "string", format: "date", description: "Average last spring frost date as YYYY-MM-DD using the current year. If frost-free, use January 1." },
    first_frost: { type: "string", format: "date", description: "Average first fall frost date as YYYY-MM-DD using the current year. If frost-free, use December 31." },
    confidence_note: { type: "string", description: "One short sentence on how confident this is and anything the gardener should double-check." },
  },
  required: ["zone", "last_frost", "first_frost", "confidence_note"],
  additionalProperties: false,
} as const;

// ---------- Season plan ----------

export const planAssignmentZ = z.object({
  crop: z.string(),
  variety_suggestion: z.string(),
  family: z.string(),
  reasoning: z.string(),
  companion_notes: z.string(),
});

export const planBedZ = z.object({
  bed_id: z.number(),
  bed_name: z.string(),
  assignments: z.array(planAssignmentZ),
  warnings: z.array(z.string()),
});

export const seasonPlanZ = z.object({
  beds: z.array(planBedZ),
  unplaced_crops: z.array(z.object({ crop: z.string(), why: z.string() })),
  summary: z.string(),
});
export type SeasonPlan = z.infer<typeof seasonPlanZ>;

export const seasonPlanJsonSchema = {
  type: "object",
  properties: {
    beds: {
      type: "array",
      description: "One entry per bed, in bed order. Include every bed even if it should rest (empty assignments with a note in warnings).",
      items: {
        type: "object",
        properties: {
          bed_id: { type: "integer" },
          bed_name: { type: "string" },
          assignments: {
            type: "array",
            items: {
              type: "object",
              properties: {
                crop: { type: "string" },
                variety_suggestion: { type: "string" },
                family: { type: "string", description: "Lowercase botanical family, e.g. solanaceae, brassicaceae, fabaceae, cucurbitaceae, apiaceae, alliaceae, asteraceae, chenopodiaceae, poaceae" },
                reasoning: { type: "string", description: "Why this crop in this bed — reference rotation history when relevant." },
                companion_notes: { type: "string", description: "Companion planting advice: what to interplant or keep away." },
              },
              required: ["crop", "variety_suggestion", "family", "reasoning", "companion_notes"],
              additionalProperties: false,
            },
          },
          warnings: { type: "array", items: { type: "string" } },
        },
        required: ["bed_id", "bed_name", "assignments", "warnings"],
        additionalProperties: false,
      },
    },
    unplaced_crops: {
      type: "array",
      items: {
        type: "object",
        properties: { crop: { type: "string" }, why: { type: "string" } },
        required: ["crop", "why"],
        additionalProperties: false,
      },
    },
    summary: { type: "string", description: "2-3 sentence plain-language overview of the season plan." },
  },
  required: ["beds", "unplaced_crops", "summary"],
  additionalProperties: false,
} as const;

// ---------- Season task schedule ----------

export const taskItemZ = z.object({
  bed_id: z.number(),
  crop: z.string(),
  type: z.enum(["plant", "fertilize", "harvest", "remove", "water", "other"]),
  title: z.string(),
  details: z.string(),
  due_start: z.string(),
  due_end: z.string(),
});

export const taskScheduleZ = z.object({ tasks: z.array(taskItemZ) });
export type TaskSchedule = z.infer<typeof taskScheduleZ>;

export const taskScheduleJsonSchema = {
  type: "object",
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          bed_id: { type: "integer" },
          crop: { type: "string" },
          type: { type: "string", enum: ["plant", "fertilize", "harvest", "remove", "water", "other"] },
          title: { type: "string", description: "Short imperative, e.g. 'Direct-sow carrots in Bed 9'" },
          details: { type: "string", description: "How and why, 1-3 sentences. Include fertilizer type/amount for fertilize tasks." },
          due_start: { type: "string", format: "date" },
          due_end: { type: "string", format: "date", description: "End of the window — give a realistic window, not a single day." },
        },
        required: ["bed_id", "crop", "type", "title", "details", "due_start", "due_end"],
        additionalProperties: false,
      },
    },
  },
  required: ["tasks"],
  additionalProperties: false,
} as const;

// ---------- Chat tools (strict tool use) ----------

export const chatTools = [
  {
    name: "log_planting",
    description:
      "Record that something was planted in a bed. Use when the gardener says they planted, sowed, or transplanted something. If the bed currently holds a crop this planting replaces, call remove_planting first.",
    strict: true,
    input_schema: {
      type: "object" as const,
      properties: {
        bed_id: { type: "integer", description: "The bed's numeric id from the garden context" },
        crop: { type: "string" },
        variety: { type: "string", description: "Variety if mentioned, else empty string" },
        family: { type: "string", description: "Lowercase botanical family of the crop" },
        planted_date: { type: "string", format: "date", description: "YYYY-MM-DD. Use today unless the gardener says otherwise." },
      },
      required: ["bed_id", "crop", "variety", "family", "planted_date"],
      additionalProperties: false,
    },
  },
  {
    name: "remove_planting",
    description:
      "Mark a current planting as removed/finished (pulled out, harvested completely, died). Matches the currently-growing planting of that crop in that bed.",
    strict: true,
    input_schema: {
      type: "object" as const,
      properties: {
        bed_id: { type: "integer" },
        crop: { type: "string", description: "The crop currently in the bed to close out" },
        removed_date: { type: "string", format: "date", description: "YYYY-MM-DD, usually today" },
      },
      required: ["bed_id", "crop", "removed_date"],
      additionalProperties: false,
    },
  },
  {
    name: "log_event",
    description:
      "Record a dated care or observation event for a bed: fertilizing, watering, a harvest (partial or final), or an issue (pests, disease, wilting, damage). Use for anything the gardener reports doing or noticing that isn't a planting/removal. For a final harvest that finishes the plant, set final_harvest true — it also closes out the planting record.",
    strict: true,
    input_schema: {
      type: "object" as const,
      properties: {
        bed_id: { type: "integer", description: "The bed's numeric id from the garden context" },
        type: { type: "string", enum: ["fertilize", "water", "harvest", "issue"] },
        crop: { type: "string", description: "The crop involved; empty string for whole-bed events like watering" },
        event_date: { type: "string", format: "date", description: "YYYY-MM-DD. Use today unless the gardener says otherwise." },
        details: {
          type: "string",
          description:
            "Specifics worth remembering: fertilizer type and amount, harvest quantity ('2 lb', 'first picking', 'last of them'), or the issue observed ('aphids on undersides', 'wilting despite moist soil').",
        },
        final_harvest: {
          type: "boolean",
          description: "true only for type=harvest when the plant is finished — also marks the planting removed as of event_date",
        },
      },
      required: ["bed_id", "type", "crop", "event_date", "details", "final_harvest"],
      additionalProperties: false,
    },
  },
  {
    name: "complete_task",
    description: "Mark an open task as done. Use the task id from the open-task list in the garden context.",
    strict: true,
    input_schema: {
      type: "object" as const,
      properties: {
        task_id: { type: "integer" },
      },
      required: ["task_id"],
      additionalProperties: false,
    },
  },
  {
    name: "add_note",
    description: "Attach a free-text note to a bed (observations, problems, reminders).",
    strict: true,
    input_schema: {
      type: "object" as const,
      properties: {
        bed_id: { type: "integer" },
        text: { type: "string" },
      },
      required: ["bed_id", "text"],
      additionalProperties: false,
    },
  },
];
