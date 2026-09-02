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
