"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Play, RotateCcw, Clock, HelpCircle } from "lucide-react";
import { clsx } from "clsx";
import { testsApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader, SpaceTabs, useSpace, pctColor } from "@/components/ui";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "new", label: "Not attempted" },
  { id: "retry", label: "Attempt again" },
  { id: "done", label: "Cleared" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

const matches = (t: any, f: Filter) =>
  f === "all" || (f === "new" && t.attempt_count === 0) || (f === "retry" && t.needs_retry) ||
  (f === "done" && t.attempt_count > 0 && !t.needs_retry);

export default function TestsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { space } = useSpace();
  const [filter, setFilter] = useState<Filter>("all");

  const { data: tests = [], isLoading } = useQuery<any[]>({
    queryKey: ["tests", space],
    queryFn: () => testsApi.list({ space }).then((r) => r.data),
  });

  const remove = useMutation({
    mutationFn: (id: string) => testsApi.delete(id),
    onSuccess: () => { toast.success("Test deleted"); qc.invalidateQueries({ queryKey: ["tests"] }); },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Could not delete"),
  });

  const shown = tests.filter((t) => matches(t, filter));

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tests</h1>
            <p className="text-gray-500 mt-1">
              {space === "common" ? "Shared tests — both of you can attempt these." : "Only you can see these."}
            </p>
          </div>
          <Link href="/tests/new" className="btn-primary flex items-center gap-2"><Plus size={16} /> New test</Link>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SpaceTabs />
          <div className="flex gap-1.5">
            {FILTERS.map((f) => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={clsx("px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                  filter === f.id ? "bg-primary-500 border-primary-500 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-primary-200")}>
                {f.label} · {tests.filter((t) => matches(t, f.id)).length}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? <Loader label="Loading tests" /> : shown.length === 0 ? (
          <div className="card text-center text-gray-400 py-12">
            {tests.length === 0 ? "No tests here yet. Create one — by form, pasted JSON or a JSON file." : "Nothing matches this filter."}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 stagger">
            {shown.map((t) => {
              const tried = t.attempt_count > 0;
              return (
                <div key={t.id} className="card lift flex flex-col gap-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{t.name}</h3>
                      <p className="text-xs text-gray-500 truncate">{t.subject_name} › {t.topic_name}</p>
                    </div>
                    <span className={clsx("text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap",
