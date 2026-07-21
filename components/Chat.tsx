"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function Chat({
  placeholder = "Tell me what you planted, or ask anything…",
  onAction,
  loadHistory = true,
}: {
  placeholder?: string;
  onAction?: () => void; // called after the assistant makes DB changes
  loadHistory?: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loadHistory) return;
    fetch("/api/ai/chat")
      .then((r) => r.json())
      .then((h) => Array.isArray(h) && setMessages(h.map((m) => ({ role: m.role, content: m.content }))));
  }, [loadHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply ?? data.error ?? "Something went wrong." }]);
      if (data.actions?.length && onAction) onAction();
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Network error — try again." }]);
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col">
      <div className="space-y-3 mb-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] whitespace-pre-wrap leading-snug ${
                m.role === "user" ? "bg-green-700 text-white" : "bg-white border border-stone-200"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-2.5 bg-white border border-stone-200 text-stone-400">Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="flex gap-2 sticky bottom-24">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-full border border-stone-300 px-4 py-3 bg-white text-[15px]"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-full bg-green-700 px-5 py-3 font-semibold text-white disabled:opacity-40"
        >
          ↑
        </button>
      </form>
    </div>
  );
}
