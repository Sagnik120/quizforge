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
