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

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-semibold text-gray-800">{test.name}</h2>
          <p className="text-sm text-gray-500">Question {currentQ + 1} of {questions.length}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm font-mono bg-gray-100 px-3 py-1.5 rounded-lg">
            <Clock size={14} /> {formatTime(elapsed)}
          </span>
          <button
            onClick={() => { if (confirm("Submit test now?")) submitMutation.mutate(); }}
            className="btn-primary text-sm"
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? "Submitting..." : "Submit Test"}
          </button>
        </div>
      </div>

      {/* Question nav dots */}
      <div className="flex flex-wrap gap-2 mb-6">
        {questions.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={clsx(
              "w-8 h-8 rounded-lg text-xs font-medium transition-colors",
              i === currentQ ? "bg-primary-500 text-white" :
              answers[questions[i].id]?.length ? "bg-green-100 text-green-700" :
              "bg-gray-100 text-gray-500 hover:bg-gray-200"
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Question card */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className={clsx("text-xs px-2.5 py-0.5 rounded-full font-medium", q.question_type === "MCQ" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700")}>
            {q.question_type}
          </span>
          <span className="text-xs text-gray-400">{q.marks} mark{q.marks > 1 ? "s" : ""}</span>
          {q.negative_marks > 0 && <span className="text-xs text-red-400">−{q.negative_marks} negative</span>}
        </div>

        <p className="text-gray-800 font-medium mb-5 leading-relaxed">{q.text}</p>

        <div className="space-y-2.5">
          {q.options.map(opt => (
            <button
              key={opt.id}
              onClick={() => toggleOption(opt.id)}
              className={clsx(
                "w-full text-left flex items-start gap-3 p-3.5 rounded-xl border transition-all",
                selected.includes(opt.id)
                  ? "border-primary-400 bg-primary-50 text-primary-800"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              )}
            >
              <span className={clsx(
                "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold",
                selected.includes(opt.id) ? "border-primary-500 bg-primary-500 text-white" : "border-gray-300"
              )}>
                {opt.id}
              </span>
              <span className="text-sm">{opt.text}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Nav buttons */}
      <div className="flex justify-between">
        <button onClick={() => goTo(currentQ - 1)} disabled={currentQ === 0} className="btn-secondary flex items-center gap-2 disabled:opacity-40">
          <ChevronLeft size={16} /> Previous
        </button>
        <button onClick={() => goTo(currentQ + 1)} disabled={currentQ === questions.length - 1} className="btn-secondary flex items-center gap-2 disabled:opacity-40">
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Result screen ───────────────────────────────────────
function ResultScreen({ result, onRetry }: { result: AttemptResult; onRetry: () => void }) {
  const router = useRouter();
  const pct = result.percentage;
  const color = pct >= 75 ? "text-green-600" : pct >= 50 ? "text-yellow-600" : "text-red-600";
  const bg = pct >= 75 ? "bg-green-50" : pct >= 50 ? "bg-yellow-50" : "bg-red-50";

  return (
    <div className="max-w-2xl mx-auto">
      <div className={`card text-center mb-6 ${bg} border-0`}>
        <p className="text-5xl font-bold mb-2 mt-2">{pct >= 75 ? "🎉" : pct >= 50 ? "👍" : "📚"}</p>
        <h2 className="text-xl font-bold text-gray-800 mb-1">{result.test_name}</h2>
        <p className={`text-5xl font-bold mt-4 mb-2 ${color}`}>{pct.toFixed(1)}%</p>
        <p className="text-gray-500">{result.score} / {result.max_score} marks</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <p className="text-2xl font-bold text-green-600">{result.correct_count}</p>
          <p className="text-xs text-gray-500 mt-1">Correct</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-red-500">{result.wrong_count}</p>
          <p className="text-xs text-gray-500 mt-1">Wrong</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-400">{result.unattempted_count}</p>
          <p className="text-xs text-gray-500 mt-1">Skipped</p>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <button onClick={onRetry} className="btn-primary flex-1">Attempt Again</button>
        <button onClick={() => router.push("/analytics")} className="btn-secondary flex-1">View Analytics</button>
      </div>

      {/* Answer review */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Answer Review</h3>
        <div className="space-y-4">
          {result.answers.map((a, i) => (
            <div key={a.question_id} className={clsx("p-4 rounded-xl", a.is_correct ? "bg-green-50" : a.selected_options.length ? "bg-red-50" : "bg-gray-50")}>
              <div className="flex items-center gap-2 mb-1">
                {a.is_correct ? <CheckCircle2 size={16} className="text-green-600" /> : a.selected_options.length ? <XCircle size={16} className="text-red-500" /> : <AlertCircle size={16} className="text-gray-400" />}
                <span className="text-xs font-medium text-gray-500">Q{i + 1}</span>
                <span className={clsx("text-xs font-semibold ml-auto", a.marks_awarded > 0 ? "text-green-700" : a.marks_awarded < 0 ? "text-red-700" : "text-gray-400")}>
                  {a.marks_awarded > 0 ? "+" : ""}{a.marks_awarded}
                </span>
              </div>
              <p className="text-xs text-gray-600">
                Correct: <span className="text-green-700 font-medium">{a.correct_options.join(", ")}</span>
                {a.selected_options.length > 0 && !a.is_correct && (
                  <> · Your answer: <span className="text-red-600 font-medium">{a.selected_options.join(", ")}</span></>
                )}
              </p>
              {a.explanation && <p className="text-xs text-gray-500 mt-1 italic">{a.explanation}</p>}
            </div>
          ))}
        </div>
