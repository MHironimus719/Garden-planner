"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Settings, Bed } from "@/lib/db";

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [zip, setZip] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        setSettings(s);
        if (s?.zip) setZip(s.zip);
      });
    fetch("/api/beds")
      .then((r) => r.json())
      .then((b) => Array.isArray(b) && setBeds(b));
  }, []);

  async function lookupZone() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/ai/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zip }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setSettings((s) => ({ ...(s as Settings), ...data }));
      setMsg(data.confidence_note ?? "Updated.");
    } else {
      setMsg(data.error ?? "Lookup failed");
    }
  }

  async function saveField(field: string, value: string) {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
  }

  async function renameBed(bed: Bed, name: string) {
    if (!name.trim() || name === bed.name) return;
    await fetch(`/api/beds/${bed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
  }

  async function finishSeason() {
    if (!confirm("End the current season? Its plan stays in history; remaining tasks are kept.")) return;
    await fetch("/api/seasons", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "finish" }),
    });
    setMsg("Season ended. Start a new plan from the Plan tab.");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <main className="px-4 pt-6">
      <h1 className="text-2xl font-bold mb-5">Settings</h1>

      <section className="rounded-xl bg-white border border-stone-200 p-4 mb-4">
        <h2 className="font-semibold mb-3">Location & climate</h2>
        <div className="flex gap-2 mb-3">
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="Zip code"
            inputMode="numeric"
            className="flex-1 rounded-lg border border-stone-300 px-3 py-2.5 bg-white"
          />
          <button
            onClick={lookupZone}
            disabled={busy || !zip}
            className="rounded-lg bg-green-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "…" : "Look up"}
          </button>
        </div>
        {settings && (
          <div className="space-y-2 text-sm">
            <label className="flex items-center justify-between gap-2">
              <span className="text-stone-500">USDA zone</span>
              <input
                defaultValue={settings.zone ?? ""}
                onBlur={(e) => saveField("zone", e.target.value)}
                className="w-28 rounded-lg border border-stone-300 px-2 py-1.5 text-right bg-white"
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-stone-500">Last spring frost</span>
              <input
                type="date"
                defaultValue={settings.last_frost ?? ""}
                onBlur={(e) => saveField("last_frost", e.target.value)}
                className="rounded-lg border border-stone-300 px-2 py-1.5 bg-white"
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-stone-500">First fall frost</span>
              <input
                type="date"
                defaultValue={settings.first_frost ?? ""}
                onBlur={(e) => saveField("first_frost", e.target.value)}
                className="rounded-lg border border-stone-300 px-2 py-1.5 bg-white"
              />
            </label>
          </div>
        )}
        {msg && <p className="text-sm text-green-800 mt-3">{msg}</p>}
      </section>

      <details className="rounded-xl bg-white border border-stone-200 p-4 mb-4">
        <summary className="font-semibold cursor-pointer">Bed names</summary>
        <ul className="mt-3 space-y-2">
          {beds.map((bed) => (
            <li key={bed.id} className="flex items-center gap-2">
              <span className="text-xs text-stone-400 w-6">#{bed.position}</span>
              <input
                defaultValue={bed.name}
                onBlur={(e) => renameBed(bed, e.target.value)}
                className="flex-1 rounded-lg border border-stone-300 px-3 py-2 bg-white"
              />
            </li>
          ))}
        </ul>
      </details>

      <button
        onClick={finishSeason}
        className="w-full rounded-xl bg-white border border-stone-300 py-3 font-medium text-stone-700 mb-3 active:bg-stone-100"
      >
        End current season
      </button>

      <button
        onClick={logout}
        className="w-full rounded-xl bg-white border border-stone-300 py-3 font-medium text-red-600 active:bg-stone-100"
      >
        Sign out
      </button>
    </main>
  );
}
