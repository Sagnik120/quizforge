"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, CornerDownRight, FolderOpen, Plus, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { subjectsApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Empty, Loader, PageHeader, SpaceTabs, confirmDialog, useSpace } from "@/components/ui";
import type { Subject, Topic } from "@/types";

const COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#22c55e", "#06b6d4", "#ef4444"];

// "Type a name, press Enter". Stays open so several can be added in a row.
function AddRow({ placeholder, onAdd, autoFocus, onClose }: {
  placeholder: string; onAdd: (name: string) => void; autoFocus?: boolean; onClose?: () => void;
}) {
  const [value, setValue] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue("");
  };
  return (
    <form onSubmit={submit} className="flex gap-2 animate-in">
      <input autoFocus={autoFocus} className="input" value={value} placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Escape" && onClose?.()} />
      <button className="btn-primary !px-3 shrink-0" aria-label="Add" disabled={!value.trim()}><Plus size={18} /></button>
    </form>
  );
}

export default function SubjectsPage() {
  const qc = useQueryClient();
  const { space } = useSpace();
  const [color, setColor] = useState(COLORS[0]);
  const [open, setOpen] = useState<string | null>(null);
  const [subFor, setSubFor] = useState<string | null>(null); // topic getting a sub-topic

  const { data: subjects = [], isLoading } = useQuery<Subject[]>({
    queryKey: ["subjects"],
    queryFn: () => subjectsApi.list().then((r) => r.data),
  });

  const run = useMutation({
    mutationFn: (action: () => Promise<any>) => action(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["tests"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Something went wrong"),
  });

  const shown = subjects.filter((s) => s.space === space);

  const remove = async (label: string, action: () => Promise<any>) => {
    const ok = await confirmDialog({
      title: `Delete "${label}"?`,
      body: "Everything inside it is deleted too, including its tests and attempts.",
      confirmLabel: "Delete", danger: true,
    });
    if (ok) run.mutate(action);
  };

  const DeleteButton = ({ label, action }: { label: string; action: () => Promise<any> }) => (
    <button aria-label={`Delete ${label}`} className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
      onClick={(e) => { e.stopPropagation(); remove(label, action); }}>
      <Trash2 size={15} />
    </button>
  );

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-5">
        <PageHeader icon={FolderOpen} tint="bg-amber-50 text-amber-600" title="Subjects & Topics" subtitle="Subject › Topic › Sub-topic. Tests attach to a topic or a sub-topic." />
        <SpaceTabs />

        {/* Step 1: a subject */}
        <div className="card space-y-3">
          <p className="section-title">New {space} subject</p>
          <AddRow placeholder="e.g. DSA, DBMS, Aptitude"
            onAdd={(name) => run.mutate(() => subjectsApi.create({ name, color, space }).then((r) => setOpen(r.data.id)))} />
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-gray-500">Colour</span>
            {COLORS.map((c) => (
              <button key={c} aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)}
                className="w-6 h-6 rounded-full transition-transform hover:scale-110 active:scale-95"
                style={{ background: c, outline: color === c ? `2px solid ${c}` : "none", outlineOffset: 2 }} />
            ))}
          </div>
        </div>

        {isLoading ? <Loader label="Loading subjects" /> : shown.length === 0 ? (
          <Empty icon={FolderOpen} title={`No ${space} subjects yet`} hint="Add a subject above. Then open it to add topics, and sub-topics under each topic." />
        ) : (
          <div className="space-y-3 stagger">
            {shown.map((s) => {
              const roots = s.topics.filter((t) => !t.parent_id);
              const kids = (t: Topic) => s.topics.filter((k) => k.parent_id === t.id);
              const isOpen = open === s.id;
              return (
                <div key={s.id} className="card !p-0 overflow-hidden">
                  {/* Subject row: tap to open */}
                  <div role="button" tabIndex={0} aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : s.id)} onKeyDown={(e) => e.key === "Enter" && setOpen(isOpen ? null : s.id)}
                    className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold shrink-0" style={{ background: s.color }}>
                      {s.name[0]?.toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                      <p className="text-xs text-gray-500">
                        {roots.length} {roots.length === 1 ? "topic" : "topics"} · {s.topics.length - roots.length} sub-topics
                      </p>
                    </div>
                    <DeleteButton label={s.name} action={() => subjectsApi.delete(s.id)} />
                    <ChevronDown size={18} className={clsx("text-gray-400 transition-transform", isOpen && "rotate-180")} />
                  </div>

                  {isOpen && (
                    <div className="border-t border-gray-100 bg-gray-50/60 p-3 sm:p-4 space-y-2 animate-in">
                      {roots.length === 0 && <p className="text-sm text-gray-500 px-1">No topics yet. Add the first one below.</p>}
                      {roots.map((t) => (
                        <div key={t.id} className="rounded-xl bg-white border border-gray-100 p-2.5 pl-3.5" style={{ borderLeft: `3px solid ${s.color}` }}>
                          <div className="flex items-center gap-1">
                            <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 break-words">{t.name}</span>
                            <button onClick={() => setSubFor(subFor === t.id ? null : t.id)}
                              className="flex items-center gap-1 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 px-2.5 py-1.5 rounded-full transition-colors shrink-0">
                              <Plus size={12} /> Sub-topic
                            </button>
                            <DeleteButton label={t.name} action={() => subjectsApi.deleteTopic(s.id, t.id)} />
                          </div>
                          {kids(t).map((k) => (
                            <div key={k.id} className="flex items-center gap-1.5 pl-1 text-sm text-gray-600">
                              <CornerDownRight size={13} className="text-gray-300 shrink-0" />
                              <span className="flex-1 min-w-0 break-words">{k.name}</span>
                              <DeleteButton label={k.name} action={() => subjectsApi.deleteTopic(s.id, k.id)} />
                            </div>
                          ))}
                          {subFor === t.id && (
                            <div className="mt-2">
                              <AddRow autoFocus placeholder={`Sub-topic under ${t.name}`} onClose={() => setSubFor(null)}
                                onAdd={(name) => run.mutate(() => subjectsApi.createTopic(s.id, { name, parent_id: t.id }))} />
                            </div>
                          )}
                        </div>
                      ))}
                      <div className="pt-1">
                        <AddRow placeholder={`Add a topic to ${s.name}`}
                          onAdd={(name) => run.mutate(() => subjectsApi.createTopic(s.id, { name }))} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
