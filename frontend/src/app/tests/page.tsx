"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, Plus, Trash2, Play, RotateCcw, Clock, HelpCircle } from "lucide-react";
import { clsx } from "clsx";
import { testsApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader, SkeletonCards, SpaceTabs, confirmDialog, useSpace, pctColor } from "@/components/ui";

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
        <PageHeader icon={BookOpen} title="Tests"
          subtitle={space === "common" ? "Shared tests. Both of you can attempt these." : "Only you can see these."}
          action={<Link href="/tests/new" className="btn-primary flex items-center gap-2"><Plus size={16} /> New test</Link>} />

        <div className="flex flex-wrap items-center gap-3">
          <SpaceTabs />
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 max-w-[100vw]">
            {FILTERS.map((f) => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={clsx("shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  filter === f.id ? "bg-primary-500 border-primary-500 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-primary-200")}>
                {f.label} · {tests.filter((t) => matches(t, f.id)).length}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? <SkeletonCards /> : shown.length === 0 ? (
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
                      !tried ? "bg-gray-100 text-gray-500" : t.needs_retry ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700")}>
                      {!tried ? "Not attempted" : t.needs_retry ? "Attempt again" : "Cleared"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><HelpCircle size={13} /> {t.total_questions} questions · {t.total_marks} marks</span>
                    <span className="flex items-center gap-1"><Clock size={13} /> {t.time_limit_minutes ? `${t.time_limit_minutes} min` : "No limit"}</span>
                  </div>

                  <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs space-y-1">
                    <p className="text-gray-600">
                      You: {tried ? (
                        <>attempted {t.attempt_count}× · best <b style={{ color: pctColor(t.best_percentage) }}>{t.best_percentage}%</b> · last {t.last_percentage}%</>
                      ) : "not attempted yet"}
                    </p>
                    {space === "common" && (
                      <p className="text-gray-500">
                        Partner: {t.partner_attempt_count > 0 ? `attempted ${t.partner_attempt_count}× · best ${t.partner_best_percentage}%` : "not attempted yet"}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-auto">
                    <Link href={`/attempt?test_id=${t.id}`} className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
                      {tried ? <><RotateCcw size={14} /> Attempt again</> : <><Play size={14} /> Start</>}
                    </Link>
                    <span className="text-[11px] text-gray-400">by {t.creator_id === user?.id ? "you" : t.creator_name}</span>
                    <button aria-label="Delete test" className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                      onClick={async () => {
                        if (await confirmDialog({ title: `Delete "${t.name}"?`, body: "All its attempts are deleted too.", confirmLabel: "Delete", danger: true })) remove.mutate(t.id);
                      }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
