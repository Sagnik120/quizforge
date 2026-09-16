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

