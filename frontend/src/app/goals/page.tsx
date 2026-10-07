"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronRight, Plus, Target, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { goalsApi, overviewApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Empty, PageHeader, SkeletonCards, Pills, ProgressBar, Ring, SpaceTabs,
  confirmDialog, displayName, personColor, ratio, useSpace,
} from "@/components/ui";

interface Goal { id: string; parent_id: string | null; title: string; space: string; done_by: string[]; }

function AddRow({ placeholder, onAdd, autoFocus }: { placeholder: string; onAdd: (title: string) => void; autoFocus?: boolean }) {
  const [value, setValue] = useState("");
  return (
    <form className="flex gap-2 animate-in" onSubmit={(e) => {
      e.preventDefault();
      if (!value.trim()) return;
      onAdd(value.trim());
      setValue("");
    }}>
      <input autoFocus={autoFocus} className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
      <button className="btn-primary !px-3 shrink-0" aria-label="Add" disabled={!value.trim()}><Plus size={18} /></button>
    </form>
  );
}

export default function GoalsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { space } = useSpace();
  const [selected, setSelected] = useState<string>("all"); // "all" or a subject goal id
  const [subFor, setSubFor] = useState<string | null>(null);

  const { data: goals = [], isLoading } = useQuery<Goal[]>({ queryKey: ["goals"], queryFn: () => goalsApi.list().then((r) => r.data) });
  const { data: overview } = useQuery({ queryKey: ["overview"], queryFn: () => overviewApi.get().then((r) => r.data) });
  const people: any[] = overview?.people || [];

  const run = useMutation({
    mutationFn: (action: () => Promise<any>) => action(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Something went wrong"),
  });

  const { children, leavesOf } = useMemo(() => {
    const children = new Map<string | null, Goal[]>();
    goals.filter((g) => g.space === space).forEach((g) => {
      children.set(g.parent_id, [...(children.get(g.parent_id) || []), g]);
    });
    // A goal with no children is its own leaf; progress is always counted in leaves
    const leavesOf = (g: Goal): Goal[] => {
      const kids = children.get(g.id) || [];
      return kids.length ? kids.flatMap(leavesOf) : [g];
    };
    return { children, leavesOf };
  }, [goals, space]);

  const roots = children.get(null) || [];
  const allLeaves = roots.flatMap(leavesOf);
  const doneBy = (leaves: Goal[], uid?: string) => leaves.filter((l) => uid && l.done_by.includes(uid)).length;
  // In the private space only your own ticks exist, so only your bar is shown
  const shownPeople = space === "common" ? people : people.filter((p) => p.is_me);
  const partners = space === "common" ? people.filter((p) => !p.is_me) : [];
  const subject = roots.find((g) => g.id === selected); // undefined => overview
  const mineAll = doneBy(allLeaves, user?.id);

  const remove = async (g: Goal, hasKids: boolean) => {
    const ok = await confirmDialog({
      title: `Delete "${g.title}"?`,
      body: hasKids ? "Everything under it is deleted too." : undefined,
      confirmLabel: "Delete", danger: true,
    });
    if (!ok) return;
    if (g.id === selected) setSelected("all");
    run.mutate(() => goalsApi.delete(g.id));
  };

  // Plain render helpers (not components) so a re-render never remounts a ticked box
  const tick = (g: Goal, big?: boolean) => {
    const leaves = leavesOf(g);
    const mine = doneBy(leaves, user?.id);
    const done = mine === leaves.length;
    return (
      <button role="checkbox" aria-checked={done} aria-label={`Mark ${g.title} done`} onClick={() => run.mutate(() => goalsApi.toggle(g.id))}
        className={clsx("rounded-lg border-2 flex items-center justify-center transition-colors shrink-0", big ? "w-7 h-7" : "w-6 h-6",
          done ? "bg-green-500 border-green-500 text-white ripple" : mine > 0 ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-primary-500")}>
        {done && <Check key="tick" size={14} strokeWidth={3} className="pop" />}
      </button>
    );
  };

  // Small coloured initials showing how far the partner is on the same item
  const partnerDots = (leaves: Goal[]) => (
    <>
      {partners.map((p) => {
        const theirs = doneBy(leaves, p.id);
        return (
          <span key={p.id} title={`${displayName(p.username)}: ${theirs}/${leaves.length}`}
            className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0"
            style={{ background: personColor(p.username), opacity: theirs === leaves.length ? 1 : theirs > 0 ? 0.5 : 0.15 }}>
            {displayName(p.username)[0]}
          </span>
        );
      })}
    </>
  );

  const deleteButton = (g: Goal, hasKids: boolean) => (
    <button aria-label={`Delete ${g.title}`} onClick={() => remove(g, hasKids)}
      className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
      <Trash2 size={15} />
    </button>
  );

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-5">
        <PageHeader icon={Target} tint="bg-pink-50 text-pink-600" title="Goals"
          subtitle={space === "common" ? "Shared syllabus. Each of you ticks your own progress." : "Your own checklist. Your partner only sees how much is done, not what."} />
        <SpaceTabs />

        {isLoading ? <SkeletonCards /> : (
          <>
            {roots.length > 0 && (
              <Pills value={subject ? selected : "all"} onChange={setSelected}
                items={[
                  { id: "all", label: "All subjects", hint: `${ratio(mineAll, allLeaves.length)}%` },
                  ...roots.map((g) => {
                    const l = leavesOf(g);
                    return { id: g.id, label: g.title, hint: `${doneBy(l, user?.id)}/${l.length}` };
                  }),
                ]} />
            )}

            {!subject ? (
              <>
                {/* Overview: where you stand, then one card per subject */}
                {roots.length > 0 && (
                  <div className="card flex items-center gap-5">
                    <Ring value={ratio(mineAll, allLeaves.length)} color="#6366f1">
                      <span className="text-xl font-bold text-gray-900">{ratio(mineAll, allLeaves.length)}%</span>
                    </Ring>
                    <div className="flex-1 min-w-0 space-y-2.5">
                      <p className="text-sm text-gray-600"><b className="text-gray-900">{mineAll}</b> done · <b className="text-gray-900">{allLeaves.length - mineAll}</b> pending</p>
                      {shownPeople.map((p) => {
                        const n = doneBy(allLeaves, p.id);
                        return (
                          <div key={p.id}>
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>{p.is_me ? "You" : displayName(p.username)}</span><span>{n}/{allLeaves.length}</span>
                            </div>
                            <ProgressBar value={ratio(n, allLeaves.length)} color={personColor(p.username)} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="card space-y-2">
                  <p className="section-title">New {space} subject goal</p>
                  <AddRow placeholder="e.g. Operating Systems"
                    onAdd={(title) => run.mutate(() => goalsApi.create({ title, space }).then((r) => setSelected(r.data.id)))} />
                </div>

                {roots.length === 0 ? (
                  <Empty icon={Target} title="No goals yet" hint="Add a subject above, then open it to list its topics and sub-topics and tick them off as you finish." />
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3 stagger">
                    {roots.map((g) => {
                      const leaves = leavesOf(g);
                      const mine = doneBy(leaves, user?.id);
                      const kids = children.get(g.id) || [];
                      return (
                        <button key={g.id} onClick={() => setSelected(g.id)} className="card lift text-left flex items-center gap-4 !p-4">
                          <Ring size={56} stroke={6} value={ratio(mine, leaves.length)}>
                            <span className="text-xs font-bold text-gray-800">{ratio(mine, leaves.length)}%</span>
                          </Ring>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{g.title}</p>
                            <p className="text-xs text-gray-500">
                              {kids.length ? `${mine} of ${leaves.length} done · ${kids.length} ${kids.length === 1 ? "topic" : "topics"}` : mine ? "Done" : "No topics yet"}
                            </p>
                          </div>
                          {partnerDots(leaves)}
                          <ChevronRight size={18} className="text-gray-300 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              /* One subject: its topics and sub-topics as a checklist */
              <div key={subject.id} className="card animate-in space-y-4">
                {(() => {
                  const leaves = leavesOf(subject);
                  const mine = doneBy(leaves, user?.id);
                  const topics = children.get(subject.id) || [];
                  return (
                    <>
                      <div className="flex items-center gap-3">
                        <Ring size={84} stroke={8} value={ratio(mine, leaves.length)}>
                          <span className="text-lg font-bold text-gray-900">{ratio(mine, leaves.length)}%</span>
                        </Ring>
                        <div className="flex-1 min-w-0">
                          <h2 className="text-lg font-semibold text-gray-900 break-words">{subject.title}</h2>
                          <p className="text-sm text-gray-600"><b className="text-gray-900">{mine}</b> done · <b className="text-gray-900">{leaves.length - mine}</b> pending</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            {tick(subject)}
                            <span className="text-xs text-gray-500">Mark all done</span>
                            {partnerDots(leaves)}
                          </div>
                        </div>
                        {deleteButton(subject, topics.length > 0)}
                      </div>

                      <div className="space-y-2">
                        {topics.length === 0 && <p className="text-sm text-gray-500">No topics yet. Add the first one below.</p>}
                        {topics.map((t) => {
                          const subs = children.get(t.id) || [];
                          const tl = leavesOf(t);
                          const tm = doneBy(tl, user?.id);
                          return (
                            <div key={t.id} className="rounded-xl border border-gray-100 bg-gray-50/60 p-2.5">
                              <div className="flex items-center gap-2.5">
                                {tick(t)}
                                <span className={clsx("flex-1 min-w-0 text-sm font-medium break-words", tm === tl.length ? "text-gray-400 line-through" : "text-gray-800")}>{t.title}</span>
                                {subs.length > 0 && <span className="text-xs text-gray-400 shrink-0">{tm}/{tl.length}</span>}
                                {partnerDots(tl)}
                                <button onClick={() => setSubFor(subFor === t.id ? null : t.id)} aria-label={`Add sub-topic under ${t.title}`}
                                  className="p-2 rounded-lg text-primary-500 hover:bg-primary-50 transition-colors shrink-0">
                                  <Plus size={16} />
                                </button>
                                {deleteButton(t, subs.length > 0)}
                              </div>
                              {subs.map((s) => {
                                const sd = doneBy([s], user?.id) === 1;
                                return (
                                  <div key={s.id} className="flex items-center gap-2.5 pl-8 py-0.5">
                                    {tick(s)}
                                    <span className={clsx("flex-1 min-w-0 text-sm break-words", sd ? "text-gray-400 line-through" : "text-gray-700")}>{s.title}</span>
                                    {partnerDots([s])}
                                    {deleteButton(s, false)}
                                  </div>
                                );
                              })}
                              {subFor === t.id && (
                                <div className="pl-8 pt-2">
                                  <AddRow autoFocus placeholder={`Sub-topic under ${t.title}`}
                                    onAdd={(title) => run.mutate(() => goalsApi.create({ title, parent_id: t.id, space }))} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <AddRow placeholder={`Add a topic to ${subject.title}`}
                        onAdd={(title) => run.mutate(() => goalsApi.create({ title, parent_id: subject.id, space }))} />
                    </>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
