"use client";

import { useEffect, useState } from "react";
import type { Season } from "@/lib/db";
import type { SeasonPlan } from "@/lib/schemas";
import Chat from "@/components/Chat";

function defaultSeasonLabel(): string {
  const now = new Date();
  const m = now.getMonth();
  const season = m <= 1 || m === 11 ? "Winter" : m <= 4 ? "Spring" : m <= 7 ? "Summer" : "Fall";
  return `${season} ${now.getFullYear()}`;
}

export default function PlanPage() {
  const [season, setSeason] = useState<Season | null | undefined>(undefined);
  const [label, setLabel] = useState(defaultSeasonLabel());
  const [cropInput, setCropInput] = useState("");
  const [crops, setCrops] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [plan, setPlan] = useState<SeasonPlan | null>(null);
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [phase, setPhase] = useState<"idle" | "generating" | "review" | "approving">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/seasons")
      .then((r) => r.json())
      .then((s) => {
        setSeason(s);
        if (s?.status === "planning" && s.plan_json) {
          setPlan(s.plan_json as SeasonPlan);
          setSeasonId(s.id);
          setPhase("review");
        }
      });
  }, []);

  function addCrop() {
    const items = cropInput
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length) setCrops((c) => [...new Set([...c, ...items])]);
    setCropInput("");
  }

  async function generate() {
    setPhase("generating");
    setError("");
    try {
      const res = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonLabel: label, desiredCrops: crops, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPlan(data.plan);
      setSeasonId(data.seasonId);
      setPhase("review");
    } catch (e) {
      setError((e as Error).message || "Plan generation failed");
      setPhase("idle");
    }
  }

  function removeAssignment(bedIdx: number, aIdx: number) {
    if (!plan) return;
    const next = structuredClone(plan);
    next.beds[bedIdx].assignments.splice(aIdx, 1);
    setPlan(next);
  }

  async function approve() {
    if (!plan || !seasonId) return;
    setPhase("approving");
    setError("");
    try {
      const res = await fetch("/api/ai/plan/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId, plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const s = await fetch("/api/seasons").then((r) => r.json());
      setSeason(s);
      setPhase("idle");
      setPlan(null);
    } catch (e) {
      setError((e as Error).message || "Approval failed");
      setPhase("review");
    }
  }

  if (season === undefined) return <main className="px-4 pt-6 text-stone-400">Loading…</main>;

  // ---------- Active season: summary + chat ----------
  if (season?.status === "active") {
    const activePlan = season.plan_json as SeasonPlan | null;
    return (
      <main className="px-4 pt-6">
        <h1 className="text-2xl font-bold mb-1">{season.label}</h1>
        {activePlan?.summary && <p className="text-stone-600 text-sm mb-4">{activePlan.summary}</p>}
        <p className="text-xs text-stone-400 mb-5">
          Tell me what you plant or harvest and I&apos;ll keep the records. Check tasks on the Today tab.
        </p>
        <Chat />
      </main>
    );
  }

  // ---------- Review a draft plan ----------
  if (phase === "review" && plan) {
    return (
      <main className="px-4 pt-6">
        <h1 className="text-2xl font-bold mb-2">Review: {label}</h1>
        <p className="text-sm text-stone-600 mb-4">{plan.summary}</p>
        <div className="space-y-3 mb-4">
          {plan.beds.map((bed, bi) => (
            <div key={bed.bed_id} className="rounded-xl bg-white border border-stone-200 p-4">
              <h3 className="font-semibold mb-1.5">{bed.bed_name}</h3>
              {bed.assignments.length === 0 && <p className="text-sm text-stone-400">Resting this season.</p>}
              {bed.assignments.map((a, ai) => (
                <div key={ai} className="mb-2.5 last:mb-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize flex-1">
                      {a.crop}
                      <span className="text-stone-400 font-normal text-sm"> · {a.variety_suggestion}</span>
                    </span>
                    <button
                      onClick={() => removeAssignment(bi, ai)}
                      className="text-stone-400 text-sm px-2 py-1"
                      aria-label={`Remove ${a.crop}`}
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-sm text-stone-600">{a.reasoning}</p>
                  {a.companion_notes && <p className="text-sm text-green-800 mt-0.5">🤝 {a.companion_notes}</p>}
                </div>
              ))}
              {bed.warnings.map((w, wi) => (
                <p key={wi} className="text-sm text-amber-700 mt-1">
                  ⚠️ {w}
                </p>
              ))}
            </div>
          ))}
        </div>
        {plan.unplaced_crops.length > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-4 text-sm">
            <p className="font-semibold text-amber-900 mb-1">Didn&apos;t fit:</p>
            {plan.unplaced_crops.map((u, i) => (
              <p key={i} className="text-amber-800">
                <span className="capitalize font-medium">{u.crop}</span>: {u.why}
              </p>
            ))}
          </div>
        )}
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setPhase("idle")}
            className="flex-1 rounded-xl border border-stone-300 bg-white py-3.5 font-semibold text-stone-700"
          >
            Start over
          </button>
          <button
            onClick={approve}
            disabled={phase !== "review"}
            className="flex-[2] rounded-xl bg-green-700 py-3.5 font-semibold text-white"
          >
            Approve & build schedule
          </button>
        </div>
      </main>
    );
  }

  if (phase === "approving") {
    return (
      <main className="px-4 pt-6 text-center">
        <div className="text-5xl mt-20 mb-4 animate-bounce">🗓️</div>
        <p className="font-medium">Building your week-by-week schedule…</p>
        <p className="text-sm text-stone-500 mt-1">This takes a minute — planting, fertilizing, and harvest tasks for the whole season.</p>
      </main>
    );
  }

  if (phase === "generating") {
    return (
      <main className="px-4 pt-6 text-center">
        <div className="text-5xl mt-20 mb-4 animate-bounce">🌱</div>
        <p className="font-medium">Planning your season…</p>
        <p className="text-sm text-stone-500 mt-1">
          Checking rotation history, companions, and your frost dates. ~30 seconds.
        </p>
      </main>
    );
  }

  // ---------- No active season: start planning ----------
  return (
    <main className="px-4 pt-6">
      <h1 className="text-2xl font-bold mb-2">Plan a season</h1>
      <p className="text-stone-600 text-sm mb-5">
        Tell me what you want to grow. I&apos;ll assign crops to beds — honoring rotation, companions, and your
        climate — and build the full task schedule once you approve.
      </p>

      <label className="block text-sm font-medium text-stone-600 mb-1">Season</label>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="w-full rounded-xl border border-stone-300 px-4 py-3 bg-white mb-4"
      />

      <label className="block text-sm font-medium text-stone-600 mb-1">Crops you want</label>
      <div className="flex gap-2 mb-2">
        <input
          value={cropInput}
          onChange={(e) => setCropInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCrop();
            }
          }}
          placeholder="tomatoes, okra, squash…"
          className="flex-1 rounded-xl border border-stone-300 px-4 py-3 bg-white"
        />
        <button onClick={addCrop} className="rounded-xl bg-green-700 px-4 font-semibold text-white">
          Add
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {crops.map((c) => (
          <button
            key={c}
            onClick={() => setCrops(crops.filter((x) => x !== c))}
            className="rounded-full bg-green-100 text-green-900 px-3 py-1.5 text-sm capitalize"
          >
            {c} ✕
          </button>
        ))}
      </div>

      <label className="block text-sm font-medium text-stone-600 mb-1">Anything else? (optional)</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="e.g. lots of tomatoes for canning, bed 3 gets afternoon shade…"
        rows={2}
        className="w-full rounded-xl border border-stone-300 px-4 py-3 bg-white mb-4"
      />

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <button
        onClick={generate}
        disabled={crops.length === 0}
        className="w-full rounded-xl bg-green-700 py-4 text-lg font-semibold text-white disabled:opacity-40"
      >
        Plan my season
      </button>
    </main>
  );
}
