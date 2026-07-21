"use client";

import { useEffect, useState, useCallback } from "react";
import type { Task, Bed } from "@/lib/db";

const typeIcons: Record<string, string> = {
  plant: "🌱",
  fertilize: "💩",
  harvest: "🧺",
  remove: "🪓",
  water: "💧",
  other: "📌",
};

type Weather = {
  place: string;
  current: { temp: number; feelsLike: number; humidity: number; wind: number; label: string; icon: string };
  today: { hi: number; lo: number; precipChance: number };
  frostWarning: { date: string; low: number } | null;
};

export default function TodayPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [t, b, w] = await Promise.all([
      fetch("/api/tasks?due=week").then((r) => r.json()),
      fetch("/api/beds").then((r) => r.json()),
      fetch("/api/weather").then((r) => r.json()).catch(() => null),
    ]);
    if (Array.isArray(t)) setTasks(t);
    if (Array.isArray(b)) setBeds(b);
    if (w && !w.error) setWeather(w);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("garden:changed", load); // assistant logged something in the chat sheet
    return () => window.removeEventListener("garden:changed", load);
  }, [load]);

  async function toggle(task: Task) {
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, done_at: task.done_at ? null : "now" } : t)));
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !task.done_at }),
    });
    load();
  }

  const bedName = (id: number | null) => beds.find((b) => b.id === id)?.name ?? "";
  const today = new Date().toISOString().slice(0, 10);
  const overdue = tasks.filter((t) => !t.done_at && t.due_end < today);
  const dueNow = tasks.filter((t) => !t.done_at && t.due_start <= today && t.due_end >= today);
  const upcoming = tasks.filter((t) => !t.done_at && t.due_start > today);

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  function TaskRow({ task, late }: { task: Task; late?: boolean }) {
    return (
      <li className="rounded-xl bg-white border border-stone-200 overflow-hidden">
        <details>
          <summary className="flex items-center gap-3 px-3 py-3.5 cursor-pointer list-none">
            <button
              onClick={(e) => {
                e.preventDefault();
                toggle(task);
              }}
              aria-label="Mark done"
              className="h-8 w-8 shrink-0 rounded-full border-2 border-green-700 flex items-center justify-center text-green-700 text-lg active:bg-green-100"
            >
              {task.done_at ? "✓" : ""}
            </button>
            <span className="text-xl">{typeIcons[task.type] ?? "📌"}</span>
            <span className="flex-1 text-base font-medium leading-snug">{task.title}</span>
            {task.bed_id && (
              <span className="shrink-0 rounded-full bg-green-100 text-green-900 text-xs px-2 py-1">
                {bedName(task.bed_id)}
              </span>
            )}
            {late && <span className="shrink-0 rounded-full bg-red-100 text-red-700 text-xs px-2 py-1">late</span>}
          </summary>
          {task.details && <p className="px-4 pb-3 text-sm text-stone-600">{task.details}</p>}
          <p className="px-4 pb-3 text-xs text-stone-400">
            Window: {task.due_start} → {task.due_end}
          </p>
        </details>
      </li>
    );
  }

  return (
    <main className="px-4 pt-6">
      <h1 className="text-2xl font-bold">Today</h1>
      <p className="text-stone-500 mb-5">{dateStr}</p>

      {weather && (
        <div className="rounded-2xl bg-sky-50 border border-sky-200 p-4 mb-5">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{weather.current.icon}</span>
            <div className="flex-1">
              <p className="text-2xl font-bold leading-none">{Math.round(weather.current.temp)}°F</p>
              <p className="text-sm text-stone-600 mt-1">
                {weather.current.label} · feels like {Math.round(weather.current.feelsLike)}°
              </p>
            </div>
            <div className="text-right text-sm text-stone-600 leading-relaxed">
              <p>
                H {Math.round(weather.today.hi)}° / L {Math.round(weather.today.lo)}°
              </p>
              <p>💧 {weather.today.precipChance}% rain</p>
              <p>💨 {Math.round(weather.current.wind)} mph</p>
            </div>
          </div>
          {weather.frostWarning && (
            <p className="mt-3 rounded-lg bg-blue-100 text-blue-900 text-sm px-3 py-2">
              ❄️ Frost risk{" "}
              {new Date(`${weather.frostWarning.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" })} —
              low of {Math.round(weather.frostWarning.low)}°. Cover tender plants.
            </p>
          )}
        </div>
      )}

      {loading && <p className="text-stone-400">Loading…</p>}

      {!loading && overdue.length === 0 && dueNow.length === 0 && (
        <div className="rounded-2xl bg-green-50 border border-green-200 p-6 text-center">
          <div className="text-4xl mb-2">🌞</div>
          <p className="text-green-900 font-medium">Nothing to do — the garden&apos;s happy.</p>
          {tasks.length === 0 && (
            <p className="text-sm text-green-800 mt-2">
              No season plan yet? Head to the Plan tab to have the AI build one.
            </p>
          )}
        </div>
      )}

      {overdue.length > 0 && (
        <section className="mb-5">
          <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide mb-2">Overdue</h2>
          <ul className="space-y-2">
            {overdue.map((t) => (
              <TaskRow key={t.id} task={t} late />
            ))}
          </ul>
        </section>
      )}

      {dueNow.length > 0 && (
        <section className="mb-5">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2">This week</h2>
          <ul className="space-y-2">
            {dueNow.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </section>
      )}

      {upcoming.length > 0 && (
        <details className="mb-5">
          <summary className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2 cursor-pointer">
            Coming up ({upcoming.length})
          </summary>
          <ul className="space-y-2 mt-2">
            {upcoming.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
