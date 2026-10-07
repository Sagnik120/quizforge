"use client";
import { useState } from "react";
import Link from "next/link";
import { useQueries, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { Bell, CalendarCheck, CalendarDays, Check, CheckCircle2, ChevronLeft, ListTodo, TrendingUp, ChevronRight, Flame, PenLine, Play, RotateCcw, Target } from "lucide-react";
import { clsx } from "clsx";
import { attemptsApi, calendarApi, goalsApi, overviewApi, testsApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { AppLayout } from "@/components/layout/AppLayout";
import { CountUp, Loader, ProgressBar, Ring, displayName, pctColor, ratio, utcDate } from "@/components/ui";

const iso = (d: Date) => format(d, "yyyy-MM-dd");

function Stat({ icon: Icon, tint, value, label }: { icon: any; tint: string; value: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
      <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", tint)}><Icon size={17} /></div>
      <div className="min-w-0">
        <p className="font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-xs text-gray-500 truncate">{label}</p>
      </div>
    </div>
  );
}

// Long lists show a few rows; the rest open in a scrolling box so the page stays short
function Capped<T>({ items, render, limit = 3 }: { items: T[]; render: (item: T) => React.ReactNode; limit?: number }) {
  const [all, setAll] = useState(false);
  return (
    <>
      <div className={clsx("divide-y divide-gray-50", all && "max-h-64 overflow-y-auto overscroll-contain pr-1")}>
        {(all ? items : items.slice(0, limit)).map(render)}
      </div>
      {items.length > limit && (
        <button onClick={() => setAll(!all)} className="mt-1.5 text-xs font-medium text-primary-600 hover:underline">
          {all ? "Show less" : `Show ${items.length - limit} more`}
        </button>
      )}
    </>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div>
      <p className="section-title mb-1.5 flex items-center gap-2">
        {title}{count ? <span className="bg-gray-100 text-gray-600 rounded-full px-1.5 py-px normal-case tracking-normal">{count}</span> : null}
      </p>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [picked, setPicked] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["overview"], queryFn: () => overviewApi.get().then((r) => r.data) });
  const { data: tests = [] } = useQuery<any[]>({ queryKey: ["tests"], queryFn: () => testsApi.list().then((r) => r.data) });
  const { data: attempts = [] } = useQuery<any[]>({ queryKey: ["my-attempts"], queryFn: () => attemptsApi.myAttempts().then((r) => r.data) });
  const { data: goals = [] } = useQuery<any[]>({ queryKey: ["goals"], queryFn: () => goalsApi.list().then((r) => r.data) });

  const today: string = data?.today || iso(new Date());
  const day = picked || today;
  const weekStart = startOfWeek(parseISO(day), { weekStartsOn: 1 });
  const week = Array.from({ length: 7 }, (_, i) => iso(addDays(weekStart, i)));
  // a week can straddle two months; the calendar API is per month
  const months = Array.from(new Set([week[0].slice(0, 7), week[6].slice(0, 7)]));
  const cal = useQueries({
    queries: months.map((m) => ({ queryKey: ["calendar", m], queryFn: () => calendarApi.month(m).then((r) => r.data) })),
  });
  const activeDays = new Set<string>(cal.flatMap((c) => c.data?.users?.find((u: any) => u.id === user?.id)?.active_days || []));
  const reminders: any[] = cal.flatMap((c) => c.data?.reminders || []);

  const toggleReminder = useMutation({
    mutationFn: (r: any) => calendarApi.updateReminder(r.id, { done: !r.done }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  // ── the selected day ──
  const isToday = day === today;
  const isFuture = day > today;
  const dayAttempts = attempts.filter((a) => a.completed_at && iso(utcDate(a.completed_at)) === day);
  const dayGoals = goals.filter((g) => g.my_done_at && iso(utcDate(g.my_done_at)) === day);
  const dayReminders = reminders.filter((r) => r.date === day);
  const remindersDone = dayReminders.filter((r) => r.done).length;
  const avg = dayAttempts.length ? Math.round(dayAttempts.reduce((s, a) => s + a.percentage, 0) / dayAttempts.length) : null;
  const planPct = ratio(remindersDone, dayReminders.length);

  // ── still open (only meaningful for today) ──
  const overdue = (data?.reminders || []).filter((r: any) => r.date < today);
  const dueToday = (data?.reminders || []).filter((r: any) => r.date === today);
  const upcoming = (data?.reminders || []).filter((r: any) => r.date > today);
  const retry = tests.filter((t) => t.needs_retry);
  const fresh = tests.filter((t) => t.attempt_count === 0);

  const me = data?.people?.find((p: any) => p.is_me);
  const goalsDone = (me?.common_goals.done || 0) + (me?.private_goals.done || 0);
  const goalsTotal = (me?.common_goals.total || 0) + (me?.private_goals.total || 0);

  // Plain render helpers (not components) so a re-render never remounts a ticked box
  const reminderRow = (r: any, showDate?: boolean) => (
    <div key={r.id} className="flex items-center gap-3 py-2">
      <button role="checkbox" aria-checked={r.done} aria-label={`Mark ${r.title} done`} onClick={() => toggleReminder.mutate(r)}
        className={clsx("w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors",
          r.done ? "bg-green-500 border-green-500 text-white ripple" : "border-gray-300 hover:border-primary-500")}>
        {r.done && <Check size={14} strokeWidth={3} className="pop" />}
      </button>
      <span className={clsx("flex-1 min-w-0 text-sm truncate", r.done ? "line-through text-gray-400" : "text-gray-800")}>{r.title}</span>
      {showDate && (
        <span className={clsx("text-xs shrink-0", r.date < today ? "text-red-500 font-medium" : "text-gray-400")}>
          {format(parseISO(r.date), "EEE d MMM")}{r.date < today && " · overdue"}
        </span>
      )}
    </div>
  );

  const testRow = (t: any, hint: string, again?: boolean) => (
    <Link key={t.id} href={`/attempt?test_id=${t.id}`} className="flex items-center gap-3 py-2 group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate group-hover:text-primary-600 transition-colors">{t.name}</p>
        <p className="text-xs text-gray-500 truncate">{t.subject_name} › {t.topic_name} · {hint}</p>
      </div>
      <span className="shrink-0 w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center transition-transform group-hover:scale-110">
        {again ? <RotateCcw size={14} /> : <Play size={14} />}
      </span>
    </Link>
  );

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="rounded-3xl bg-gradient-to-br from-primary-50 via-white to-pink-50 border border-white p-5 sm:p-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-gray-500 flex items-center gap-1.5"><CalendarDays size={14} /> {format(parseISO(today), "EEEE, d MMMM")}</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mt-1">Hi <span className="marker">{displayName(user?.username)}</span> <span className="inline-block bob">👋</span></h1>
            <p className="text-sm text-gray-500 mt-1">
              {me?.active_today ? "You have already studied today. Keep going!" : "A small step today keeps the streak alive."}
            </p>
          </div>
          <Link href="/tests" className="btn-primary flex items-center gap-2 shrink-0"><Play size={15} /> <span className="hidden sm:inline">Take a test</span><span className="sm:hidden">Test</span></Link>
        </div>

        {isLoading ? <Loader label="Loading your day" /> : (
          <>
            {/* Day picker: one week at a time, today by default */}
            <div className="card !p-3 sm:!p-4">
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-sm font-semibold text-gray-800 flex items-center gap-2"><CalendarCheck size={16} className="text-primary-500" /> {format(weekStart, "MMMM yyyy")}</p>
                <div className="flex items-center gap-1">
                  {!isToday && <button onClick={() => setPicked(null)} className="text-xs font-medium text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full mr-1">Today</button>}
                  <button aria-label="Previous week" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" onClick={() => setPicked(iso(addDays(parseISO(day), -7)))}><ChevronLeft size={18} /></button>
                  <button aria-label="Next week" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" onClick={() => setPicked(iso(addDays(parseISO(day), 7)))}><ChevronRight size={18} /></button>
                  <Link href="/calendar" className="text-xs text-gray-500 hover:text-primary-600 ml-1 hidden sm:block">Full calendar</Link>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {week.map((d) => {
                  const due = reminders.filter((r) => r.date === d && !r.done).length;
                  return (
                    <button key={d} onClick={() => setPicked(d)} aria-pressed={d === day}
                      className={clsx("relative flex flex-col items-center gap-0.5 py-2 rounded-xl transition-all active:scale-95",
                        d === day ? "bg-gray-900 text-white shadow-md" : d === today ? "bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-50")}>
                      <span className={clsx("text-[11px]", d === day ? "text-gray-300" : "text-gray-400")}>{format(parseISO(d), "EEE")}</span>
                      <span className="text-base font-semibold">{Number(d.slice(8))}</span>
                      <span className="flex gap-0.5 h-1.5">
                        {activeDays.has(d) && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" title="You were active" />}
                        {due > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-300" title={`${due} reminder(s) open`} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* The selected day at a glance */}
            <div key={day} className="card animate-in">
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                <div className="flex items-center gap-4 sm:w-64 shrink-0">
                  <Ring value={dayReminders.length ? planPct : 0} color={dayReminders.length ? undefined : "#e5e7eb"}>
                    <span className="text-xl font-bold text-gray-900">{dayReminders.length ? `${planPct}%` : "—"}</span>
                    <span className="text-[10px] text-gray-400">planned</span>
                  </Ring>
                  <div className="min-w-0">
                    <p className="section-title">{isToday ? "Today" : format(parseISO(day), "EEE, d MMM")}</p>
                    <p className="font-semibold text-gray-900 mt-0.5">
                      {dayReminders.length
                        ? remindersDone === dayReminders.length ? "Everything planned is done" : `${dayReminders.length - remindersDone} of ${dayReminders.length} still pending`
                        : isFuture ? "Nothing planned yet" : "No reminders planned"}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {isFuture ? "Add reminders from the calendar." : activeDays.has(day) ? "Streak day ✓" : isToday ? "Finish a test or tick a goal to keep your streak." : "No activity on this day."}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 flex-1">
                  <Stat icon={PenLine} tint="bg-primary-50 text-primary-600" value={<CountUp value={dayAttempts.length} />} label="tests taken" />
                  <Stat icon={TrendingUp} tint="bg-green-50 text-green-600" value={avg === null ? "—" : <CountUp value={avg} suffix="%" />} label="avg score" />
                  <Stat icon={Target} tint="bg-pink-50 text-pink-600" value={<CountUp value={dayGoals.length} />} label="goals ticked" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-x-8 gap-y-5 mt-5 pt-5 border-t border-gray-100">
                <Section title={isFuture ? "Planned" : "Reminders"} count={dayReminders.length}>
                  {dayReminders.length === 0
                    ? <p className="text-sm text-gray-400 py-1">None. <Link href="/calendar" className="text-primary-600 hover:underline">Add one</Link></p>
                    : <Capped limit={4} items={dayReminders} render={(r) => reminderRow(r)} />}
                </Section>
                {!isFuture && (
                  <Section title="Done this day" count={dayAttempts.length + dayGoals.length}>
                    {dayAttempts.length + dayGoals.length === 0 ? <p className="text-sm text-gray-400 py-1">Nothing yet.</p> : (
                      <Capped limit={4} items={[...dayAttempts.map((a) => ({ a })), ...dayGoals.map((g) => ({ g }))] as any[]}
                        render={({ a, g }) => a ? (
                          <div key={a.id} className="flex items-center gap-3 py-2">
                            <PenLine size={15} className="text-primary-500 shrink-0" />
                            <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">{a.test_name}</span>
                            <span className="text-sm font-semibold" style={{ color: pctColor(a.percentage) }}>{Math.round(a.percentage)}%</span>
                          </div>
                        ) : (
                          <div key={g.id} className="flex items-center gap-3 py-2">
                            <Check size={15} strokeWidth={3} className="text-green-500 shrink-0" />
                            <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">{g.title}</span>
                            <span className="text-xs text-gray-400">goal</span>
                          </div>
                        )} />
                    )}
                  </Section>
                )}
              </div>
            </div>

            {/* What is still open: only relevant when looking at today */}
            {isToday && (
              <div className="grid md:grid-cols-2 gap-4 stagger">
                <div className="card space-y-4">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2"><ListTodo size={16} className="text-primary-500" /> Pick up next</h2>
                  {retry.length + fresh.length === 0 && <p className="text-sm text-gray-400">No tests waiting. <Link href="/tests/new" className="text-primary-600 hover:underline">Create one</Link></p>}
                  {retry.length > 0 && (
                    <Section title="Attempt again" count={retry.length}>
                      <Capped items={retry} render={(t) => testRow(t, `best ${t.best_percentage}%`, true)} />
                    </Section>
                  )}
                  {fresh.length > 0 && (
                    <Section title="Not attempted yet" count={fresh.length}>
                      <Capped items={fresh} render={(t) => testRow(t, `${t.total_questions} questions`)} />
                    </Section>
                  )}
                </div>

                <div className="card space-y-4">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Bell size={16} className="text-amber-500" /> Pending reminders</h2>
                  {overdue.length + dueToday.length + upcoming.length === 0 && (
                    <p className="text-sm text-gray-400 flex items-center gap-2"><CheckCircle2 size={16} className="text-green-500" /> All clear: nothing pending today or in the next 7 days.</p>
                  )}
                  {overdue.length > 0 && (
                    <Section title="Overdue" count={overdue.length}>
                      <Capped items={overdue} render={(r: any) => reminderRow(r, true)} />
                    </Section>
                  )}
                  {dueToday.length > 0 && (
                    <Section title="Today" count={dueToday.length}>
                      <Capped items={dueToday} render={(r: any) => reminderRow(r)} />
                    </Section>
                  )}
                  {upcoming.length > 0 && (
                    <Section title="Next 7 days" count={upcoming.length}>
                      <Capped items={upcoming} render={(r: any) => reminderRow(r, true)} />
                    </Section>
                  )}
                </div>
              </div>
            )}

            {/* Long-term progress: only your own, kept below the day view */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Target size={16} className="text-pink-500" /> Your overall progress</h2>
                <span className="flex items-center gap-1 text-sm text-orange-600 font-semibold">
                  <span className={me?.current_streak > 0 ? "flame" : ""}><Flame size={16} /></span>{me?.current_streak ?? 0} day streak
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                <Link href="/goals" className="flex items-center gap-4 sm:w-64 shrink-0 group">
                  <Ring value={ratio(goalsDone, goalsTotal)} color="#6366f1">
                    <span className="text-xl font-bold text-gray-900">{ratio(goalsDone, goalsTotal)}%</span>
                    <span className="text-[10px] text-gray-400">goals</span>
                  </Ring>
                  <div>
                    <p className="text-sm text-gray-600"><b className="text-gray-900">{goalsDone}</b> done · <b className="text-gray-900">{goalsTotal - goalsDone}</b> pending</p>
                    <p className="text-xs text-primary-600 group-hover:underline mt-0.5">Open goals</p>
                  </div>
                </Link>
                <div className="flex-1 space-y-3">
                  {[["Private goals", me?.private_goals, "#6366f1"], ["Common goals (your ticks)", me?.common_goals, "#ec4899"]].map(([label, g, color]: any) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs text-gray-500 mb-1"><span>{label}</span><span>{g?.done ?? 0}/{g?.total ?? 0}</span></div>
                      <ProgressBar value={ratio(g?.done ?? 0, g?.total ?? 0)} color={color} />
                    </div>
                  ))}
                  <p className="text-xs text-gray-500">{me?.attempts ?? 0} tests taken in total · average {me?.average_percentage ?? 0}% · best streak {me?.longest_streak ?? 0} days</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
