"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Bed, Planting } from "@/lib/db";
import { familyColor } from "@/lib/families";

export default function BedDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [bed, setBed] = useState<Bed | null>(null);
  const [plantings, setPlantings] = useState<Planting[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [form, setForm] = useState({ crop: "", variety: "", planted_date: new Date().toISOString().slice(0, 10) });

  const load = useCallback(async () => {
    const [beds, p] = await Promise.all([
      fetch("/api/beds").then((r) => r.json()),
      fetch(`/api/plantings?bed=${id}`).then((r) => r.json()),
    ]);
    if (Array.isArray(beds)) setBed(beds.find((b: Bed) => b.id === Number(id)) ?? null);
    if (Array.isArray(p)) setPlantings(p);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const current = plantings.filter((p) => !p.removed_date);
  const history = plantings.filter((p) => p.removed_date);

  async function removePlanting(p: Planting) {
    if (!confirm(`Mark ${p.crop} as removed?`)) return;
    await fetch(`/api/plantings/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removed_date: new Date().toISOString().slice(0, 10) }),
    });
    load();
  }

  async function addPlanting(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/plantings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bed_id: Number(id), ...form, variety: form.variety || null }),
    });
    setForm({ crop: "", variety: "", planted_date: new Date().toISOString().slice(0, 10) });
    load();
  }

  async function saveName() {
    if (newName.trim()) {
      await fetch(`/api/beds/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
    }
    setRenaming(false);
    load();
  }

  if (!bed) return <main className="px-4 pt-6 text-stone-400">Loading…</main>;

  return (
    <main className="px-4 pt-6">
      <button onClick={() => router.push("/beds")} className="text-green-800 mb-3 text-sm font-medium">
        ← All beds
      </button>

      <div className="flex items-center gap-2 mb-5">
        {renaming ? (
          <>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-xl font-bold bg-white"
              autoFocus
            />
            <button onClick={saveName} className="text-green-800 font-semibold px-2 py-2">
              Save
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold flex-1">{bed.name}</h1>
            <button
              onClick={() => {
                setNewName(bed.name);
                setRenaming(true);
              }}
              className="text-stone-400 text-sm px-2 py-2"
            >
              Rename
            </button>
          </>
        )}
      </div>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">Growing now</h2>
        {current.length === 0 && <p className="text-stone-400">Nothing planted.</p>}
        <ul className="space-y-2">
          {current.map((p) => (
            <li key={p.id} className="rounded-xl bg-white border border-stone-200 p-4 flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full shrink-0 ${familyColor(p.family)}`} />
              <div className="flex-1">
                <p className="font-semibold capitalize">
                  {p.crop}
                  {p.variety && <span className="font-normal text-stone-500"> · {p.variety}</span>}
                </p>
                <p className="text-sm text-stone-500">Planted {p.planted_date}</p>
              </div>
              <button
                onClick={() => removePlanting(p)}
                className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600 active:bg-stone-100"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <details className="mb-6 rounded-xl bg-white border border-stone-200 p-4">
        <summary className="font-medium text-green-800 cursor-pointer">+ Add a planting</summary>
        <form onSubmit={addPlanting} className="mt-3 space-y-3">
          <input
            value={form.crop}
            onChange={(e) => setForm({ ...form, crop: e.target.value })}
            placeholder="Crop (e.g. carrots)"
            required
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 bg-white"
          />
          <input
            value={form.variety}
            onChange={(e) => setForm({ ...form, variety: e.target.value })}
            placeholder="Variety (optional)"
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 bg-white"
          />
          <input
            type="date"
            value={form.planted_date}
            onChange={(e) => setForm({ ...form, planted_date: e.target.value })}
            className="w-full rounded-lg border border-stone-300 px-3 py-2.5 bg-white"
          />
          <button type="submit" className="w-full rounded-lg bg-green-700 py-2.5 font-semibold text-white">
            Add
          </button>
          <p className="text-xs text-stone-400">
            Tip: it&apos;s easier to just tell the chat on the Plan tab — &quot;planted carrots in {bed.name} today&quot;.
          </p>
        </form>
      </details>

      {bed.notes && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">Notes</h2>
          <p className="rounded-xl bg-white border border-stone-200 p-4 text-sm whitespace-pre-wrap">{bed.notes}</p>
        </section>
      )}

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">History</h2>
        {history.length === 0 && <p className="text-stone-400 text-sm">No past plantings recorded yet.</p>}
        <ul className="space-y-1.5">
          {history.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 text-sm text-stone-600 px-1 py-1.5">
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${familyColor(p.family)}`} />
              <span className="capitalize font-medium">{p.crop}</span>
              <span className="text-stone-400">
                {p.planted_date} → {p.removed_date}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
