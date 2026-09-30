"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { Loader } from "@/components/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { testsApi, attemptsApi, subjectsApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, CheckCircle2, XCircle, AlertCircle, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { Subject, AttemptResult, QuestionPublic } from "@/types";

// ─── Test selector ───────────────────────────────────────
function TestSelector({ onSelect }: { onSelect: (id: string) => void }) {
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const { data: subjects = [] } = useQuery<Subject[]>({ queryKey: ["subjects"], queryFn: () => subjectsApi.list().then(r => r.data) });
  const { data: tests = [] } = useQuery({ queryKey: ["tests", topicId, subjectId], queryFn: () => testsApi.list({ topic_id: topicId || undefined, subject_id: subjectId || undefined }).then(r => r.data) });
  const selectedSubject = subjects.find((s: Subject) => s.id === subjectId);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Attempt a Test</h1>
      <p className="text-gray-500 mb-6">Choose a subject, topic and test to begin</p>

      <div className="card space-y-4">
        <div>
          <label className="label">Subject</label>
          <select className="input" value={subjectId} onChange={e => { setSubjectId(e.target.value); setTopicId(""); }}>
            <option value="">All Subjects</option>
            {subjects.map((s: Subject) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {selectedSubject && (
          <div>
            <label className="label">Topic</label>
            <select className="input" value={topicId} onChange={e => setTopicId(e.target.value)}>
              <option value="">All Topics</option>
              {selectedSubject.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
        {tests.length > 0 && (
          <div>
            <label className="label">Test</label>
