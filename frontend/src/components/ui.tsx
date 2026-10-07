"use client";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { clsx } from "clsx";
import { useEffect, useState } from "react";
import { Lock, Users } from "lucide-react";
import type { Space } from "@/types";

export function Loader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500 fade" role="status" aria-live="polite">
      <div className="book"><i /><i /><i /></div>
      <div className="writing" />
      <p className="text-sm dots">{label}</p>
    </div>
  );
}

// Grey placeholder cards in the shape of what is about to appear
export function SkeletonCards({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={clsx("grid sm:grid-cols-2 gap-3", className)} role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card !p-4 flex items-center gap-4">
          <div className="skeleton w-14 h-14 !rounded-full shrink-0" />
          <div className="flex-1 space-y-2"><div className="skeleton h-4 w-2/3" /><div className="skeleton h-3 w-1/2" /></div>
        </div>
      ))}
    </div>
  );
}

// Shown at the top of the screen whenever any request is in flight
export function TopProgress() {
  const busy = useIsFetching() + useIsMutating() > 0;
  return busy ? <div className="top-progress" role="progressbar" aria-label="Loading" /> : null;
}

// Numbers count up to their value instead of just appearing
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(value); return; }
    const from = shown, start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 600);
      setShown(from + (value - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{Number.isInteger(value) ? Math.round(shown) : shown.toFixed(1)}{suffix}</>;
}

const CONFETTI = ["#6366f1", "#ec4899", "#f59e0b", "#22c55e", "#06b6d4"];
// A one-off burst of paper bits, for a good score or a finished subject
export function Confetti({ pieces = 22 }: { pieces?: number }) {
  const [bits] = useState(() => Array.from({ length: pieces }, (_, i) => {
    const angle = (i / pieces) * Math.PI * 2 + Math.random() * 0.5;
    const reach = 70 + Math.random() * 90;
    return { dx: Math.cos(angle) * reach, dy: Math.sin(angle) * reach - 40, rot: Math.random() * 540 - 270, color: CONFETTI[i % CONFETTI.length], delay: Math.random() * 0.12 };
  }));
  return (
    <div className="confetti" aria-hidden>
      {bits.map((b, i) => (
        <span key={i} style={{ background: b.color, animationDelay: `${b.delay}s`, ["--dx" as any]: `${b.dx}px`, ["--dy" as any]: `${b.dy}px`, ["--rot" as any]: `${b.rot}deg` }} />
      ))}
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
    <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit shrink-0">
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

// The two people are fixed accounts; show their account name, not the editable profile name
export const displayName = (username?: string) =>
  username ? username[0].toUpperCase() + username.slice(1) : "";

// API timestamps are UTC without a zone marker
export const utcDate = (iso: string) => new Date(/Z|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);

export function Ring({ value, size = 96, stroke = 9, color, children }: {
  value: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // start empty so the arc sweeps in on mount
  const [shown, setShown] = useState(0);
  useEffect(() => { setShown(pct); }, [pct]);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef2f7" strokeWidth={stroke} />
        <circle className="ring-arc" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color || pctColor(pct)}
          strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (shown / 100) * c} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

// Horizontally scrollable chips: one way to pick a subject everywhere
export function Pills<T extends string>({ items, value, onChange }: {
  items: { id: T; label: string; hint?: string | number; color?: string }[]; value: T; onChange: (id: T) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
      {items.map((it) => (
        <button key={it.id} onClick={() => onChange(it.id)}
          className={clsx("shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border transition-all active:scale-95",
            value === it.id ? "bg-gray-900 border-gray-900 text-white shadow-sm" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300")}>
          {it.color && <span className="w-2 h-2 rounded-full" style={{ background: it.color }} />}
          {it.label}
          {it.hint !== undefined && <span className={clsx("text-xs", value === it.id ? "text-gray-300" : "text-gray-400")}>{it.hint}</span>}
        </button>
      ))}
    </div>
  );
}

// ─── Confirm dialog (replaces the browser's confirm box) ───
interface Ask { title: string; body?: string; confirmLabel?: string; danger?: boolean; }
const useConfirmStore = create<{ ask: Ask | null; resolve: ((ok: boolean) => void) | null }>(() => ({ ask: null, resolve: null }));

export const confirmDialog = (ask: Ask) =>
  new Promise<boolean>((resolve) => useConfirmStore.setState({ ask, resolve }));

export function ConfirmHost() {
  const { ask, resolve } = useConfirmStore();
  if (!ask) return null;
  const close = (ok: boolean) => { resolve?.(ok); useConfirmStore.setState({ ask: null, resolve: null }); };
  return (
    <Modal onClose={() => close(false)}>
      <h3 className="text-lg font-semibold text-gray-900">{ask.title}</h3>
      {ask.body && <p className="text-sm text-gray-500 mt-1.5">{ask.body}</p>}
      <div className="flex gap-2 mt-5">
        <button className="btn-secondary flex-1" onClick={() => close(false)}>Cancel</button>
        <button autoFocus onClick={() => close(true)}
          className={clsx("btn-primary flex-1", ask.danger && "!bg-red-500 hover:!bg-red-600 !shadow-red-500/20")}>
          {ask.confirmLabel || "Confirm"}
        </button>
      </div>
    </Modal>
  );
}

// Centered on desktop, a bottom sheet on phones
export function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-gray-900/40 backdrop-blur-sm fade" onClick={onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}
        className="sheet bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl max-h-[85vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action, icon: Icon, tint = "bg-primary-50 text-primary-600" }: {
  title: string; subtitle?: React.ReactNode; action?: React.ReactNode; icon?: any; tint?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <div className={clsx("w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 pop", tint)}><Icon size={22} /></div>}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight"><span className="marker">{title}</span></h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Empty({ icon: Icon, title, hint, children }: { icon: any; title: string; hint?: string; children?: React.ReactNode }) {
  return (
    <div className="card text-center py-10">
      <div className="bob w-14 h-14 mx-auto rounded-2xl bg-primary-50 text-primary-500 flex items-center justify-center mb-3"><Icon size={26} /></div>
      <p className="font-medium text-gray-800">{title}</p>
      {hint && <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">{hint}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
