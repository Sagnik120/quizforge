"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { clsx } from "clsx";
import { Lock, Users } from "lucide-react";
import type { Space } from "@/types";

export function Loader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500" role="status">
      <div className="loader-dots"><span /><span /><span /></div>
      <p className="text-sm">{label}</p>
    </div>
  );
}

// red below 60, amber below 80, green above — the same cut-off the API uses for "attempt again"
export const pctColor = (pct: number) => (pct < 60 ? "#ef4444" : pct < 80 ? "#f59e0b" : "#22c55e");

// One colour per person, so dots, bars and avatars always mean the same thing
export const personColor = (username: string) =>
  username.toLowerCase().startsWith("shr") ? "#ec4899" : "#6366f1";

export function ProgressBar({ value, color, className }: { value: number; color?: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={clsx("h-2 w-full rounded-full bg-gray-100 overflow-hidden", className)}>
      <div className="bar-fill h-full rounded-full" style={{ width: `${pct}%`, background: color || pctColor(pct) }} />
    </div>
  );
}

export const ratio = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

// The selected space is remembered across pages and reloads
export const useSpace = create<{ space: Space; setSpace: (s: Space) => void }>()(
  persist((set) => ({ space: "private", setSpace: (space) => set({ space }) }), { name: "prepduo-space" })
);

export function SpaceTabs() {
  const { space, setSpace } = useSpace();
  const tabs = [
    { id: "private" as Space, label: "Private", icon: Lock },
    { id: "common" as Space, label: "Common", icon: Users },
  ];
  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setSpace(id)}
          className={clsx(
            "px-4 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all",
            space === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <Icon size={14} /> {label}
        </button>
      ))}
    </div>
  );
}

export function SpaceBadge({ space }: { space: Space }) {
  return (
    <span className={clsx("text-[11px] px-2 py-0.5 rounded-full font-medium",
      space === "common" ? "bg-pink-50 text-pink-600" : "bg-gray-100 text-gray-500")}>
      {space === "common" ? "Common" : "Private"}
    </span>
  );
}

export function Avatar({ name, username, size = 32 }: { name: string; username: string; size?: number }) {
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, background: personColor(username), fontSize: size * 0.42 }}>
      {name[0]?.toUpperCase()}
    </div>
  );
}
