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
            <div className="space-y-2">
              {tests.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => onSelect(t.id)}
                  className="w-full text-left border border-gray-200 hover:border-primary-400 hover:bg-primary-50 rounded-xl p-4 transition-colors"
                >
                  <p className="font-medium text-gray-800">{t.name}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {t.total_questions} questions · {t.total_marks} marks
                    {t.time_limit_minutes ? ` · ${t.time_limit_minutes} min` : ""} · {t.attempt_count} attempts
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
        {tests.length === 0 && (topicId || subjectId) && (
          <p className="text-sm text-gray-400 text-center py-4">No tests found in this selection.</p>
        )}
      </div>
    </div>
  );
}

// ─── Test in progress ────────────────────────────────────
function TestAttempt({ testId, onDone }: { testId: string; onDone: (result: AttemptResult) => void }) {
  const router = useRouter();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [timers, setTimers] = useState<Record<string, number>>({});
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const qStartRef = useRef(Date.now());

  const { data: test } = useQuery({
    queryKey: ["test-attempt", testId],
    queryFn: () => testsApi.getForAttempt(testId).then(r => r.data),
  });

  const startMutation = useMutation({
    mutationFn: () => attemptsApi.start(testId).then(r => r.data),
    onSuccess: (d) => setAttemptId(d.attempt_id),
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      const ans = Object.entries(answers).map(([question_id, selected_options]) => ({
        question_id, selected_options, time_spent_seconds: timers[question_id] || 0,
      }));
      return attemptsApi.submit(attemptId!, ans).then(r => r.data);
    },
    onSuccess: (result) => onDone(result),
    onError: () => toast.error("Submission failed"),
  });

  useEffect(() => { startMutation.mutate(); }, [testId]);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  if (!test || !attemptId) return <div className="text-center py-20 text-gray-400">Loading test...</div>;

  const questions: QuestionPublic[] = test.questions;
  const q = questions[currentQ];
  const selected = answers[q.id] || [];

  const toggleOption = (optId: string) => {
    setAnswers(prev => {
      const cur = prev[q.id] || [];
      if (q.question_type === "MCQ") return { ...prev, [q.id]: [optId] };
      return { ...prev, [q.id]: cur.includes(optId) ? cur.filter(x => x !== optId) : [...cur, optId] };
    });
  };

  const goTo = (idx: number) => {
    const spent = Math.floor((Date.now() - qStartRef.current) / 1000);
    setTimers(t => ({ ...t, [q.id]: (t[q.id] || 0) + spent }));
    qStartRef.current = Date.now();
    setCurrentQ(idx);
  };

