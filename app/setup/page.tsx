"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Bed, Planting } from "@/lib/db";
import { familyColor } from "@/lib/families";
import Chat from "@/components/Chat";

type ZoneResult = {
  zone: string;
  last_frost: string;
  first_frost: string;
  confidence_note: string;
};

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [zip, setZip] = useState("");
  const [zone, setZone] = useState<ZoneResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [beds, setBeds] = useState<Bed[]>([]);
  const [plantings, setPlantings] = useState<Planting[]>([]);

  useEffect(() => {
    loadBeds();
  }, []);

  async function loadBeds() {
    const [b, p] = await Promise.all([
      fetch("/api/beds").then((r) => r.json()),
      fetch("/api/plantings?current=1").then((r) => r.json()),
    ]);
    if (Array.isArray(b)) setBeds(b);
    if (Array.isArray(p)) setPlantings(p);
  }

  async function lookupZone(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setZone(data);
    } catch (e) {
      setError((e as Error).message || "Lookup failed. Is the database set up?");
    }
    setBusy(false);
  }

  async function renameBed(bed: Bed, name: string) {
    if (!name.trim() || name === bed.name) return;
    await fetch(`/api/beds/${bed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
  }

  return (
    <main className="px-4 pt-8 pb-10">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">🪴</div>
        <h1 className="text-2xl font-bold">Welcome to your garden</h1>
        <p className="text-stone-500 text-sm mt-1">Step {step} of 3</p>
      </div>

      {step === 1 && (
        <section>
          <h2 className="font-semibold text-lg mb-2">Where do you garden?</h2>
          <p className="text-sm text-stone-600 mb-4">
            Your zip code sets your growing zone and frost dates — everything the AI plans is based on them.
          </p>
          <form onSubmit={lookupZone} className="flex gap-2 mb-4">
            <input
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="Zip code"
              inputMode="numeric"
              autoFocus
              className="flex-1 rounded-xl border border-stone-300 px-4 py-3.5 text-lg bg-white"
            />
            <button
              type="submit"
              disabled={busy || !zip}
              className="rounded-xl bg-green-700 px-5 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "…" : "Go"}
            </button>
          </form>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          {zone && (
            <div className="rounded-xl bg-green-50 border border-green-200 p-4 mb-4">
              <p className="font-semibold text-green-900 mb-1">Zone {zone.zone}</p>
              <p className="text-sm text-green-800">Last spring frost ≈ {zone.last_frost}</p>
              <p className="text-sm text-green-800">First fall frost ≈ {zone.first_frost}</p>
              <p className="text-xs text-green-700 mt-2">{zone.confidence_note} (You can adjust these in Settings.)</p>
            </div>
          )}
          <button
            onClick={() => setStep(2)}
            disabled={!zone}
            className="w-full rounded-xl bg-green-700 py-3.5 text-lg font-semibold text-white disabled:opacity-40"
          >
            Looks right →
          </button>
        </section>
      )}

      {step === 2 && (
        <section>
          <h2 className="font-semibold text-lg mb-2">Name your beds</h2>
          <p className="text-sm text-stone-600 mb-4">
            16 beds are ready. Rename any of them if you use names like &quot;Fence bed&quot; — or just keep the numbers.
          </p>
          <ul className="space-y-2 mb-5 max-h-96 overflow-y-auto">
            {beds.map((bed) => (
              <li key={bed.id} className="flex items-center gap-2">
                <span className="text-xs text-stone-400 w-6">#{bed.position}</span>
                <input
                  defaultValue={bed.name}
                  onBlur={(e) => renameBed(bed, e.target.value)}
                  className="flex-1 rounded-lg border border-stone-300 px-3 py-2.5 bg-white"
                />
              </li>
            ))}
          </ul>
          <button
            onClick={() => setStep(3)}
            className="w-full rounded-xl bg-green-700 py-3.5 text-lg font-semibold text-white"
          >
            Next →
          </button>
        </section>
      )}

      {step === 3 && (
        <section>
          <h2 className="font-semibold text-lg mb-2">What&apos;s growing right now?</h2>
          <p className="text-sm text-stone-600 mb-4">
            Just tell me in plain English — one bed at a time or all at once. For example: &quot;Bed 1 has tomatoes,
            beds 2 and 3 are okra, bed 4 is empty.&quot; If you remember last season, tell me that too — it makes
            rotation advice smarter.
          </p>

          <div className="grid grid-cols-5 gap-1.5 mb-4">
            {beds.map((bed) => {
              const current = plantings.filter((p) => p.bed_id === bed.id);
              return (
                <div key={bed.id} className="rounded-lg bg-white border border-stone-200 p-1.5 text-center">
                  <p className="text-[10px] text-stone-400 truncate">{bed.name}</p>
                  {current.length ? (
                    current.slice(0, 2).map((p) => (
                      <p key={p.id} className="text-[10px] capitalize truncate flex items-center gap-0.5 justify-center">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${familyColor(p.family)}`} />
                        {p.crop}
                      </p>
                    ))
                  ) : (
                    <p className="text-[10px] text-stone-300">—</p>
                  )}
                </div>
              );
            })}
          </div>

          <Chat placeholder="Bed 1 has tomatoes, bed 2 is empty…" onAction={loadBeds} loadHistory={false} />

          <button
            onClick={() => router.push("/today")}
            className="w-full rounded-xl bg-green-700 py-3.5 text-lg font-semibold text-white mt-6"
          >
            Done — take me to my garden
          </button>
        </section>
      )}
    </main>
  );
}
