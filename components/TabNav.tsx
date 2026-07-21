"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/today", label: "Today", icon: "☀️" },
  { href: "/beds", label: "Beds", icon: "🪴" },
  { href: "/plan", label: "Plan", icon: "🌿" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function TabNav() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/setup") return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 border-t border-stone-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-2xl grid grid-cols-4">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 min-h-16 justify-center text-xs font-medium ${
                active ? "text-green-800" : "text-stone-500"
              }`}
            >
              <span className="text-2xl leading-none">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
