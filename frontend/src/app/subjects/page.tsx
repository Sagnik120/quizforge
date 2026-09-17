"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, CornerDownRight } from "lucide-react";
import { subjectsApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader, SpaceTabs, useSpace } from "@/components/ui";
import type { Subject, Topic } from "@/types";

const COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#22c55e", "#06b6d4", "#ef4444"];

// A one-line "type and press Enter" input used for subjects, topics and sub-topics
function QuickAdd({ placeholder, onAdd, small }: { placeholder: string; onAdd: (name: string) => void; small?: boolean }) {
  const [value, setValue] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue("");
  };
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input className={small ? "input !py-1 !text-xs" : "input"} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
      <button className={small ? "btn-secondary !px-2 !py-1" : "btn-primary"} aria-label="Add"><Plus size={small ? 13 : 16} /></button>
    </form>
  );
}

export default function SubjectsPage() {
  const qc = useQueryClient();
  const { space } = useSpace();
  const [color, setColor] = useState(COLORS[0]);

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

  const DeleteButton = ({ label, action }: { label: string; action: () => Promise<any> }) => (
    <button aria-label={`Delete ${label}`} className="p-1 text-gray-300 hover:text-red-500 transition-colors"
      onClick={() => { if (confirm(`Delete "${label}" with everything inside it (tests and attempts too)?`)) run.mutate(action); }}>
      <Trash2 size={14} />
    </button>
  );

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subjects & Topics</h1>
          <p className="text-gray-500 mt-1">Subject › Topic › Sub-topic. Tests attach to a topic or a sub-topic.</p>
        </div>
        <SpaceTabs />

        <div className="card space-y-3">
          <QuickAdd placeholder={`New ${space} subject, e.g. DSA, DBMS, Aptitude`}
            onAdd={(name) => run.mutate(() => subjectsApi.create({ name, color, space }))} />
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button key={c} aria-label={`Colour ${c}`} onClick={() => setColor(c)}
                className="w-5 h-5 rounded-full transition-transform hover:scale-125"
                style={{ background: c, outline: color === c ? `2px solid ${c}` : "none", outlineOffset: 2 }} />
            ))}
          </div>
        </div>

        {isLoading ? <Loader label="Loading subjects" /> : shown.length === 0 ? (
          <div className="card text-center text-gray-400 py-10">No {space} subjects yet.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 stagger">
            {shown.map((s) => {
              const roots = s.topics.filter((t) => !t.parent_id);
              const kids = (t: Topic) => s.topics.filter((k) => k.parent_id === t.id);
              return (
                <div key={s.id} className="card lift space-y-3" style={{ borderTop: `3px solid ${s.color}` }}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{s.name}</h3>
                    <DeleteButton label={s.name} action={() => subjectsApi.delete(s.id)} />
                  </div>
                  {roots.map((t) => (
                    <div key={t.id} className="rounded-lg bg-gray-50 p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-800">{t.name}</span>
                        <DeleteButton label={t.name} action={() => subjectsApi.deleteTopic(s.id, t.id)} />
                      </div>
                      {kids(t).map((k) => (
                        <div key={k.id} className="flex items-center justify-between pl-2 text-sm text-gray-600">
                          <span className="flex items-center gap-1.5"><CornerDownRight size={12} className="text-gray-300" />{k.name}</span>
                          <DeleteButton label={k.name} action={() => subjectsApi.deleteTopic(s.id, k.id)} />
                        </div>
                      ))}
                      <QuickAdd small placeholder="Add sub-topic"
                        onAdd={(name) => run.mutate(() => subjectsApi.createTopic(s.id, { name, parent_id: t.id }))} />
                    </div>
                  ))}
                  <QuickAdd small placeholder="Add topic"
                    onAdd={(name) => run.mutate(() => subjectsApi.createTopic(s.id, { name }))} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
