"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const getSpeechRecognition = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const emptySubscribe = () => () => {};
const voiceSupportedSnapshot = () => !!getSpeechRecognition();
const voiceSupportedServerSnapshot = () => false;

export default function Chat({
  placeholder = "Tell me what you planted, or ask anything…",
  onAction,
  loadHistory = true,
  formClassName = "sticky bottom-24",
}: {
  placeholder?: string;
  onAction?: () => void; // called after the assistant makes DB changes
  loadHistory?: boolean;
  formClassName?: string; // positioning of the input row (overridden inside the chat sheet)
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const voiceSupported = useSyncExternalStore(emptySubscribe, voiceSupportedSnapshot, voiceSupportedServerSnapshot);
  const bottomRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const dictationBaseRef = useRef(""); // input text present before dictation started

  useEffect(() => () => recognitionRef.current?.abort(), []);

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    if (!recognitionRef.current) {
      const SR = getSpeechRecognition();
      if (!SR) return;
      const rec = new SR();
      rec.lang = navigator.language || "en-US";
      rec.interimResults = true;
      rec.continuous = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (e: any) => {
        let transcript = "";
        for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
        setInput(`${dictationBaseRef.current} ${transcript}`.trimStart());
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recognitionRef.current = rec;
    }
    dictationBaseRef.current = input.trim();
    recognitionRef.current.start();
    setListening(true);
  }

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
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
    }
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
      <form onSubmit={send} className={`flex gap-2 ${formClassName}`}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-full border border-stone-300 px-4 py-3 bg-white text-[15px]"
        />
        {voiceSupported && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={listening ? "Stop dictation" : "Dictate with your voice"}
            className={`rounded-full px-4 py-3 border ${
              listening
                ? "bg-red-600 border-red-600 text-white animate-pulse"
                : "bg-white border-stone-300"
            }`}
          >
            🎤
          </button>
        )}
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
