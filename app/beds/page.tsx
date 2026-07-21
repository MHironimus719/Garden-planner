"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Bed, Planting } from "@/lib/db";
import { familyColor } from "@/lib/families";

export default function BedsPage() {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [plantings, setPlantings] = useState<Planting[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/beds").then((r) => r.json()),
      fetch("/api/plantings?current=1").then((r) => r.json()),
    ]).then(([b, p]) => {
      if (Array.isArray(b)) setBeds(b);
      if (Array.isArray(p)) setPlantings(p);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("garden:changed", load); // assistant logged something in the chat sheet
    return () => window.removeEventListener("garden:changed", load);
  }, [load]);

  return (
    <main className="px-4 pt-6">
      <h1 className="text-2xl font-bold mb-5">Beds</h1>
      {loading && <p className="text-stone-400">Loading…</p>}
      <div className="grid grid-cols-3 gap-3">
        {beds.map((bed) => {
          const current = plantings.filter((p) => p.bed_id === bed.id);
          return (
            <Link
              key={bed.id}
              href={`/beds/${bed.id}`}
              className="rounded-2xl bg-white border border-stone-200 p-3 min-h-28 flex flex-col active:bg-stone-100"
            >
              <span className="text-sm font-semibold text-stone-700">{bed.name}</span>
              <span className="mt-1 flex-1 text-sm text-stone-900 leading-tight">
                {current.length ? (
                  current.map((p) => (
                    <span key={p.id} className="flex items-center gap-1.5 mt-0.5">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${familyColor(p.family)}`} />
                      <span className="capitalize truncate">{p.crop}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-stone-400">empty</span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
