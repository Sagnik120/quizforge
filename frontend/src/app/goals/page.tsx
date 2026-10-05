"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Plus, Trash2, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { goalsApi, overviewApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader, ProgressBar, SpaceTabs, useSpace, personColor, ratio } from "@/components/ui";

interface Goal { id: string; parent_id: string | null; title: string; space: string; done_by: string[]; }
const MAX_DEPTH = 3; // subject > topic > sub-topic
const LEVELS = ["subject", "topic", "sub-topic"];

export default function GoalsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { space } = useSpace();
  const [draft, setDraft] = useState("");
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [childDraft, setChildDraft] = useState("");
  const [closed, setClosed] = useState<Set<string>>(new Set());

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

  const addChild = (parent: Goal) => {
    if (!childDraft.trim()) return;
    run.mutate(() => goalsApi.create({ title: childDraft.trim(), parent_id: parent.id, space }));
    setChildDraft("");
  };

  const renderGoal = (g: Goal, depth: number) => {
    const kids = children.get(g.id) || [];
    const leaves = leavesOf(g);
    const mine = doneBy(leaves, user?.id);
    const done = mine === leaves.length;
    const open = !closed.has(g.id);
    return (
      <div key={g.id} className="animate-in">
        <div className="group flex items-center gap-2 py-1.5 rounded-lg hover:bg-gray-50 px-2" style={{ marginLeft: depth * 22 }}>
          <button aria-label={open ? "Collapse" : "Expand"} disabled={!kids.length}
            onClick={() => setClosed((s) => { const n = new Set(s); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n; })}
            className={clsx("text-gray-400 transition-transform", open && kids.length && "rotate-90", !kids.length && "opacity-0")}>
            <ChevronRight size={14} />
          </button>
          <button role="checkbox" aria-checked={done} aria-label={`Mark ${g.title} done`} onClick={() => run.mutate(() => goalsApi.toggle(g.id))}
            className={clsx("w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0",
              done ? "bg-green-500 border-green-500 text-white" : mine > 0 ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-primary-500")}>
            {done && <Check key="tick" size={13} strokeWidth={3} className="pop" />}
          </button>
          <span className={clsx("flex-1 text-sm transition-colors", depth === 0 && "font-semibold", done ? "text-gray-400 line-through" : "text-gray-800")}>
            {g.title}
          </span>
          {kids.length > 0 && <span className="text-xs text-gray-400">{mine}/{leaves.length}</span>}
          {space === "common" && people.filter((p) => !p.is_me).map((p) => {
            const theirs = doneBy(leaves, p.id);
            return (
              <span key={p.id} title={`${p.full_name}: ${theirs}/${leaves.length}`}
                className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center text-white transition-opacity"
                style={{ background: personColor(p.username), opacity: theirs === leaves.length ? 1 : theirs > 0 ? 0.5 : 0.15 }}>
                {p.full_name[0]}
              </span>
            );
          })}
          {depth < MAX_DEPTH - 1 && (
            <button aria-label={`Add ${LEVELS[depth + 1]}`} className="p-1 text-gray-300 hover:text-primary-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
              onClick={() => { setAddingTo(addingTo === g.id ? null : g.id); setChildDraft(""); }}>
              <Plus size={14} />
            </button>
          )}
          <button aria-label={`Delete ${g.title}`} className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            onClick={() => { if (confirm(`Delete "${g.title}"${kids.length ? " and everything under it" : ""}?`)) run.mutate(() => goalsApi.delete(g.id)); }}>
            <Trash2 size={14} />
          </button>
        </div>
        {addingTo === g.id && (
          <form onSubmit={(e) => { e.preventDefault(); addChild(g); }} className="flex gap-2 py-1 animate-in" style={{ marginLeft: (depth + 1) * 22 + 30 }}>
            <input autoFocus className="input !py-1 !text-sm" value={childDraft} onChange={(e) => setChildDraft(e.target.value)} placeholder={`New ${LEVELS[depth + 1]} under ${g.title}`} />
            <button className="btn-secondary !py-1 text-sm">Add</button>
          </form>
        )}
        {open && kids.map((k) => renderGoal(k, depth + 1))}
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Goals</h1>
          <p className="text-gray-500 mt-1">
            {space === "common" ? "Shared syllabus — each of you ticks your own progress." : "Your own checklist. Your partner only sees how much is done, not what."}
          </p>
        </div>
        <SpaceTabs />

        <div className="card space-y-3">
          {shownPeople.map((p) => {
            const n = doneBy(allLeaves, p.id);
            return (
              <div key={p.id}>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{p.is_me ? "You" : p.full_name}</span>
                  <span>{n}/{allLeaves.length} · {ratio(n, allLeaves.length)}%</span>
                </div>
                <ProgressBar value={ratio(n, allLeaves.length)} color={personColor(p.username)} />
              </div>
            );
          })}
        </div>

        <div className="card">
          <form className="flex gap-2 mb-3" onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            run.mutate(() => goalsApi.create({ title: draft.trim(), space }));
            setDraft("");
          }}>
            <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`New ${space} goal (a subject), e.g. Operating Systems`} />
            <button className="btn-primary flex items-center gap-1"><Plus size={16} /> Add</button>
          </form>
          {isLoading ? <Loader label="Loading goals" /> : roots.length === 0
            ? <p className="text-sm text-gray-400 py-6 text-center">No goals yet. Add a subject, then hover it and press + to add topics and sub-topics.</p>
            : roots.map((g) => renderGoal(g, 0))}
        </div>
      </div>
    </AppLayout>
  );
}
