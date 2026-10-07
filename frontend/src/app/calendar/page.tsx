"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { addMonths, format, getDay, getDaysInMonth, parseISO, startOfMonth } from "date-fns";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, Flame, Trash2, Check } from "lucide-react";
import { clsx } from "clsx";
import { calendarApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader, PageHeader, SpaceBadge, personColor } from "@/components/ui";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPage() {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [picked, setPicked] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [shared, setShared] = useState(false);
  const month = format(cursor, "yyyy-MM");

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", month],
    queryFn: () => calendarApi.month(month).then((r) => r.data),
    placeholderData: (prev: any) => prev, // keep the old grid visible while the next month loads
  });

  const run = useMutation({
    mutationFn: (action: () => Promise<any>) => action(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Something went wrong"),
  });

  const day = picked || data?.today;
  const remindersOn = (iso: string) => (data?.reminders || []).filter((r: any) => r.date === iso);
  const blanks = (getDay(cursor) + 6) % 7; // weeks start on Monday
  const days = Array.from({ length: getDaysInMonth(cursor) }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-5">
        <PageHeader icon={CalendarDays} tint="bg-orange-50 text-orange-600" title="Calendar"
          subtitle="A day lights up when you finish a test or tick a goal. Ticking a reminder only ticks it for you." />

        {!data ? <Loader label="Loading calendar" /> : (
          <>
            <div className="grid sm:grid-cols-2 gap-3 sm:gap-4 stagger">
              {data.users.map((u: any) => (
                <div key={u.id} className="card lift flex items-center gap-3 !py-4">
                  <span className={clsx("text-orange-500", u.current_streak > 0 && "flame")}><Flame size={26} /></span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{u.full_name}</p>
                    <p className="text-xs text-gray-500">best {u.longest_streak} days · {u.active_days.length} active this month</p>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: personColor(u.username) }}>{u.current_streak}<span className="text-xs font-normal text-gray-400"> day streak</span></p>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <div className="card lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <button aria-label="Previous month" className="btn-secondary !p-2" onClick={() => setCursor(addMonths(cursor, -1))}><ChevronLeft size={16} /></button>
                  <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                    {format(cursor, "MMMM yyyy")}
                    {isLoading || data.month !== month ? <span className="loader-dots scale-50"><span /><span /><span /></span> : null}
                  </h2>
                  <button aria-label="Next month" className="btn-secondary !p-2" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight size={16} /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center text-xs text-gray-400 mb-1.5">
                  {WEEKDAYS.map((d) => <div key={d}>{d}</div>)}
                </div>
                <div key={month} className="grid grid-cols-7 gap-1 sm:gap-1.5 animate-in">
                  {Array.from({ length: blanks }, (_, i) => <div key={`b${i}`} />)}
                  {days.map((iso) => {
                    const active = data.month === month ? data.users.filter((u: any) => u.active_days.includes(iso)) : [];
                    const due = data.month === month ? remindersOn(iso) : [];
                    return (
                      <button key={iso} onClick={() => setPicked(iso)}
                        className={clsx("h-14 sm:h-16 rounded-lg border text-left p-1 sm:p-1.5 flex flex-col transition-all hover:border-primary-300 hover:-translate-y-0.5",
                          iso === day ? "border-primary-500 ring-2 ring-primary-100" : "border-gray-100",
                          active.length ? "bg-orange-50/60" : "bg-white")}>
                        <span className={clsx("text-xs font-medium", iso === data.today ? "bg-primary-500 text-white rounded-full w-5 h-5 flex items-center justify-center" : "text-gray-700")}>
                          {Number(iso.slice(8))}
                        </span>
                        <span className="flex gap-1 mt-auto items-center">
                          {active.map((u: any) => (
                            <span key={u.id} title={`${u.full_name} was active`} className="w-2 h-2 rounded-full pop" style={{ background: personColor(u.username) }} />
                          ))}
                          {due.length > 0 && (
                            <span className={clsx("ml-auto text-[10px] font-semibold px-1 rounded", due.every((r: any) => r.done) ? "bg-gray-100 text-gray-400" : "bg-amber-100 text-amber-700")}>
                              {due.length}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-xs text-gray-500">
                  {data.users.map((u: any) => (
                    <span key={u.id} className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: personColor(u.username) }} />{u.full_name} active</span>
                  ))}
                  <span className="flex items-center gap-1.5"><span className="px-1 rounded bg-amber-100 text-amber-700 text-[10px] font-semibold">n</span>reminders</span>
                </div>
              </div>

              <div className="card space-y-3">
                <h2 className="font-semibold text-gray-800">{format(parseISO(day), "EEEE, d MMM")}</h2>
                <form className="space-y-2" onSubmit={(e) => {
                  e.preventDefault();
                  if (!title.trim()) return;
                  run.mutate(() => calendarApi.addReminder({ title: title.trim(), date: day, space: shared ? "common" : "private" }));
                  setTitle("");
                }}>
                  <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reminder, e.g. TCS mock test" />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} /> Share with partner
                    </label>
                    <button className="btn-primary !py-1.5 text-sm">Add</button>
                  </div>
                </form>
                <div className="divide-y divide-gray-50">
                  {remindersOn(day).length === 0 && <p className="text-sm text-gray-400 py-3">No reminders on this day.</p>}
                  {remindersOn(day).map((r: any) => (
                    <div key={r.id} className="flex items-center gap-2 py-2 animate-in">
                      <button role="checkbox" aria-checked={r.done} aria-label={`Mark ${r.title} done`}
                        onClick={() => run.mutate(() => calendarApi.updateReminder(r.id, { done: !r.done }))}
                        className={clsx("w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                          r.done ? "bg-green-500 border-green-500 text-white ripple" : "border-gray-300 hover:border-primary-500")}>
                        {r.done && <Check size={13} strokeWidth={3} className="pop" />}
                      </button>
                      <span className={clsx("flex-1 text-sm", r.done ? "line-through text-gray-400" : "text-gray-800")}>{r.title}</span>
                      <SpaceBadge space={r.space} />
                      <button aria-label={`Delete ${r.title}`} className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                        onClick={() => run.mutate(() => calendarApi.deleteReminder(r.id))}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
