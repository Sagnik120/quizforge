"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Flame, RotateCcw, Sparkles, Bell } from "lucide-react";
import { overviewApi, testsApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar, Loader, ProgressBar, SpaceBadge, personColor, ratio } from "@/components/ui";

function PersonCard({ p }: { p: any }) {
  const color = personColor(p.username);
  const bars = [
    { label: "Common goals", ...p.common_goals },
    { label: p.is_me ? "My private goals" : "Private goals", ...p.private_goals },
  ];
  return (
    <div className="card lift">
      <div className="flex items-center gap-3 mb-5">
        <Avatar name={p.full_name} username={p.username} size={44} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{p.full_name}{p.is_me && <span className="text-gray-400 font-normal"> · you</span>}</p>
          <p className="text-xs text-gray-500">{p.active_today ? "Active today ✓" : "Nothing done yet today"}</p>
        </div>
        <div className="flex items-center gap-1 text-orange-600 font-bold text-lg">
          <span className={p.current_streak > 0 ? "flame" : ""}><Flame size={20} /></span>{p.current_streak}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center mb-5">
        {[[p.attempts, "tests taken"], [`${p.average_percentage}%`, "avg score"], [p.longest_streak, "best streak"]].map(([v, l]) => (
          <div key={l as string} className="rounded-lg bg-gray-50 py-2">
            <p className="font-bold text-gray-900">{v}</p>
            <p className="text-[11px] text-gray-500">{l}</p>
          </div>
        ))}
      </div>
      {bars.map((b) => (
        <div key={b.label} className="mb-3 last:mb-0">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{b.label}</span><span>{b.done}/{b.total}</span>
