"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, BarChart2, BookMarked, CheckCircle, ChevronRight, Clock, Flame, PenLine, Trophy, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { analyticsApi, attemptsApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Empty, Loader, PageHeader, Pills, ProgressBar, Ring, SpaceBadge, pctColor, utcDate } from "@/components/ui";

// Weakest first; things never attempted sink to the bottom
const byWeakness = (a: any, b: any) => (a.percentage ?? 101) - (b.percentage ?? 101);

function Strength({ node, sub }: { node: any; sub?: boolean }) {
  const tried = node.percentage !== null;
  return (
    <div className={sub ? "pl-5 py-1.5" : "py-2"}>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className={sub ? "text-sm text-gray-600 truncate" : "text-sm font-medium text-gray-800 truncate"}>{node.name}</span>
        <span className="text-xs font-semibold shrink-0" style={{ color: tried ? pctColor(node.percentage) : "#9ca3af" }}>
          {tried ? `${node.percentage}%${node.percentage < 60 ? " · weak" : ""}` : "not attempted"}
        </span>
      </div>
      {tried ? <ProgressBar value={node.percentage} className={sub ? "!h-1.5" : undefined} /> : <div className="h-2 rounded-full bg-gray-100" />}
    </div>
  );
}

function Tile({ icon: Icon, tint, value, label }: { icon: any; tint: string; value: React.ReactNode; label: string }) {
  return (
    <div className="card !p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tint}`}><Icon size={18} /></div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-gray-900 leading-tight truncate">{value}</p>
        <p className="text-xs text-gray-500 truncate">{label}</p>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState("overview"); // "overview" or a subject id

  const [allAttempts, setAllAttempts] = useState(false);
  const summary = useQuery({ queryKey: ["analytics"], queryFn: () => analyticsApi.summary().then((r) => r.data) });
  const weak = useQuery<any[]>({ queryKey: ["weak-areas"], queryFn: () => analyticsApi.weakAreas().then((r) => r.data) });
  const { data: attempts = [] } = useQuery<any[]>({ queryKey: ["my-attempts"], queryFn: () => attemptsApi.myAttempts().then((r) => r.data) });
  const analytics = summary.data;
  const areas = weak.data || [];
  const failed = summary.isError || weak.isError;
  const { data: revision = [] } = useQuery<any[]>({ queryKey: ["revision"], queryFn: () => analyticsApi.revisionQueue().then((r) => r.data) });

  const resolve = useMutation({
    mutationFn: (id: string) => analyticsApi.resolveRevision(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revision"] });
      toast.success("Marked as understood");
    },
  });

  // Several attempts on one day become that day's average
  const trend = useMemo(() => {
    const days = new Map<string, number[]>();
    (analytics?.recent_performance || []).forEach((p: any) => days.set(p.date, [...(days.get(p.date) || []), p.percentage]));
    return Array.from(days, ([date, v]) => ({ date, percentage: Math.round(v.reduce((a, b) => a + b, 0) / v.length), tests: v.length }));
  }, [analytics]);

  const subjects = [...areas].sort(byWeakness);
  const subject = areas.find((s) => s.id === selected);
  const queueFor = (s: any) => revision.filter((r) => r.subject_name === s.name);
  const weakIn = (s: any) => s.topics.flatMap((t: any) => [t, ...t.subtopics]).filter((n: any) => n.percentage !== null && n.percentage < 60);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-5">
        <PageHeader icon={BarChart2} tint="bg-sky-50 text-sky-600" title="Analytics" subtitle="How you are doing overall, then one subject at a time." />

        {failed ? (
          <Empty icon={AlertTriangle} title="Could not load your analytics" hint="The server did not answer. Check that the backend is running, then try again.">
            <button className="btn-primary" onClick={() => { summary.refetch(); weak.refetch(); }}>Try again</button>
          </Empty>
        ) : summary.isLoading || weak.isLoading || !analytics ? <Loader label="Crunching your numbers" /> : (
          <>
            <Pills value={subject ? selected : "overview"} onChange={setSelected}
              items={[
                { id: "overview", label: "Overview" },
                ...subjects.map((s) => ({ id: s.id, label: s.name, hint: s.percentage === null ? "–" : `${Math.round(s.percentage)}%` })),
              ]} />

            {!subject ? (
              <div className="space-y-5 animate-in">
                {analytics.total_attempts === 0 && (
                  <div className="card !p-4 flex flex-wrap items-center gap-3 border-primary-100 bg-primary-50/50">
                    <p className="flex-1 min-w-[12rem] text-sm text-gray-700">
                      <b>You have not finished a test yet.</b> Analytics only counts your own attempts, so the numbers below fill in after your first one.
                    </p>
                    <Link href="/tests" className="btn-primary text-sm">Take a test</Link>
                  </div>
                )}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
                  <Tile icon={PenLine} tint="bg-primary-50 text-primary-600" value={analytics.total_attempts} label={`attempts on ${analytics.total_tests_attempted} tests`} />
                  <Tile icon={TrendingUp} tint="bg-green-50 text-green-600" value={`${analytics.average_percentage}%`} label="average score" />
                  <Tile icon={Trophy} tint="bg-amber-50 text-amber-600" value={`${analytics.best_percentage}%`} label="best score" />
                  <Tile icon={Clock} tint="bg-sky-50 text-sky-600" value={`${analytics.total_time_spent_hours}h`} label="time in tests" />
                </div>

                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900">Score trend · last 30 days</h2>
                    <span className="flex items-center gap-1 text-xs text-orange-600 font-medium"><Flame size={14} /> {analytics.current_streak} now · best {analytics.longest_streak}</span>
                  </div>
                  {trend.length === 0 ? <p className="text-sm text-gray-400 py-6 text-center">No tests in the last 30 days.</p> : (
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={trend} margin={{ left: -18, right: 8, top: 4 }}>
                        <defs>
                          <linearGradient id="score" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(d) => format(parseISO(d), "d MMM")} minTickGap={24} />
                        <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} unit="%" />
                        <Tooltip formatter={(v: any, _n, p: any) => [`${v}% · ${p.payload.tests} test${p.payload.tests > 1 ? "s" : ""}`, "Average"]}
                          labelFormatter={(d) => format(parseISO(d as string), "EEE, d MMM")} contentStyle={{ borderRadius: 12, border: "1px solid #f1f5f9", fontSize: 12 }} />
                        <Area type="monotone" dataKey="percentage" stroke="#6366f1" strokeWidth={2.5} fill="url(#score)" dot={{ r: 3, fill: "#6366f1" }} activeDot={{ r: 5 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {attempts.length > 0 && (
                  <div className="card">
                    <h2 className="font-semibold text-gray-900 mb-2">Recent attempts</h2>
                    <div className={allAttempts ? "divide-y divide-gray-50 max-h-72 overflow-y-auto overscroll-contain pr-1" : "divide-y divide-gray-50"}>
                      {(allAttempts ? attempts : attempts.slice(0, 5)).map((a) => (
                        <div key={a.id} className="flex items-center gap-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{a.test_name}</p>
                            <p className="text-xs text-gray-500">{a.completed_at ? format(utcDate(a.completed_at), "EEE, d MMM · h:mm a") : ""} · {a.score}/{a.max_score} marks</p>
                          </div>
                          <span className="text-sm font-semibold" style={{ color: pctColor(a.percentage) }}>{Math.round(a.percentage)}%</span>
                        </div>
                      ))}
                    </div>
                    {attempts.length > 5 && (
                      <button onClick={() => setAllAttempts(!allAttempts)} className="mt-1.5 text-xs font-medium text-primary-600 hover:underline">
                        {allAttempts ? "Show less" : `Show ${attempts.length - 5} more`}
                      </button>
                    )}
                  </div>
                )}

                <div>
                  <p className="section-title mb-2">By subject · weakest first</p>
                  {subjects.length === 0 ? (
                    <Empty icon={BarChart2} title="Nothing to analyse yet" hint="Add subjects and attempt a few tests to see this fill in.">
                      <Link href="/tests" className="btn-primary inline-block">Go to tests</Link>
                    </Empty>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-3 stagger">
                      {subjects.map((s) => {
                        const weakCount = weakIn(s).length;
                        const queue = queueFor(s).length;
                        return (
                          <button key={s.id} onClick={() => setSelected(s.id)} className="card lift text-left flex items-center gap-4 !p-4">
                            <Ring size={56} stroke={6} value={s.percentage ?? 0} color={s.percentage === null ? "#e5e7eb" : undefined}>
                              <span className="text-xs font-bold text-gray-800">{s.percentage === null ? "–" : `${Math.round(s.percentage)}%`}</span>
                            </Ring>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                              <p className="text-xs text-gray-500 truncate">
                                {s.attempts ? `${s.attempts} attempt${s.attempts > 1 ? "s" : ""}` : "Not attempted yet"}
                                {weakCount > 0 && <span className="text-red-500"> · {weakCount} weak</span>}
                                {queue > 0 && ` · ${queue} to revise`}
                              </p>
                            </div>
                            <ChevronRight size={18} className="text-gray-300 shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div key={subject.id} className="space-y-5 animate-in">
                <div className="card flex items-center gap-5">
                  <Ring value={subject.percentage ?? 0} color={subject.percentage === null ? "#e5e7eb" : undefined}>
                    <span className="text-xl font-bold text-gray-900">{subject.percentage === null ? "–" : `${Math.round(subject.percentage)}%`}</span>
                  </Ring>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-gray-900 truncate">{subject.name}</h2>
                      <SpaceBadge space={subject.space} />
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {subject.attempts ? `Marks earned out of marks possible over ${subject.attempts} attempt${subject.attempts > 1 ? "s" : ""}.` : "No attempts in this subject yet."}
                    </p>
                    {weakIn(subject).length > 0 && (
                      <p className="text-sm text-red-600 mt-1.5 flex items-start gap-1.5">
                        <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                        <span>Focus on: {weakIn(subject).sort(byWeakness).slice(0, 3).map((n: any) => n.name).join(", ")}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="card">
                  <h3 className="font-semibold text-gray-900">Topics and sub-topics</h3>
                  <p className="text-xs text-gray-500 mb-2">Under 60% is weak.</p>
                  {subject.topics.length === 0 ? <p className="text-sm text-gray-400 py-2">This subject has no topics yet.</p> : (
                    <div className="divide-y divide-gray-50">
                      {[...subject.topics].sort(byWeakness).map((t: any) => (
                        <div key={t.id} className="py-1">
                          <Strength node={t} />
                          {[...t.subtopics].sort(byWeakness).map((st: any) => <Strength key={st.id} node={st} sub />)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <BookMarked size={17} className="text-primary-600" /> Revision queue
                    <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-medium">{queueFor(subject).length}</span>
                  </h3>
                  <p className="text-xs text-gray-500 mb-3">Questions you got wrong in this subject.</p>
                  {queueFor(subject).length === 0 ? <p className="text-sm text-gray-400 py-2">Nothing to revise here.</p> : (
                    <div className="space-y-2.5">
                      {queueFor(subject).map((item) => (
                        <div key={item.id} className="rounded-xl border border-gray-100 p-3 sm:p-4">
                          <p className="text-sm font-medium text-gray-800 line-clamp-3">{item.question_text}</p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{item.topic_name}</span>
                            <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded">Wrong {item.wrong_count}×</span>
                            <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">{item.question_type}</span>
                            <button onClick={() => resolve.mutate(item.id)} disabled={resolve.isPending}
                              className="ml-auto flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors">
                              <CheckCircle size={14} /> Got it
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
