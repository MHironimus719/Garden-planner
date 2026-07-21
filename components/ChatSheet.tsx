"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Chat from "./Chat";

// Floating assistant button + slide-up chat sheet, available on every tab.
// Pages that show live garden data listen for "garden:changed" to refetch
// after the assistant logs something.
export default function ChatSheet() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (pathname === "/login" || pathname === "/setup") return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask the garden assistant"
        className="fixed bottom-24 right-4 z-40 h-14 w-14 rounded-full bg-green-700 text-2xl text-white shadow-lg active:bg-green-800"
      >
        💬
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 mx-auto flex h-[85dvh] max-w-2xl flex-col rounded-t-2xl bg-stone-50"
          >
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <h2 className="font-semibold">Garden assistant</h2>
              <button onClick={() => setOpen(false)} aria-label="Close chat" className="px-2 text-stone-500">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-[env(safe-area-inset-bottom)]">
              <Chat
                placeholder="What should I replant in bed 4?…"
                formClassName="sticky bottom-0 bg-stone-50 py-2"
                onAction={() => window.dispatchEvent(new Event("garden:changed"))}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
