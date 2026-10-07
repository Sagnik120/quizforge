"use client";
import { useState, useEffect, useRef, Suspense } from "react";
import { Confetti, CountUp, Loader, Modal, PageHeader, ProgressBar, Ring } from "@/components/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { testsApi, attemptsApi, subjectsApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, CheckCircle2, XCircle, AlertCircle, Play, ChevronLeft, ChevronRight, Lightbulb, PenLine, RotateCcw, BarChart2 } from "lucide-react";
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
      <div className="mb-6"><PageHeader icon={PenLine} title="Attempt a Test" subtitle="Choose a subject, topic and test to begin" /></div>

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
function TestAttempt({ testId, onDone }: { testId: string; onDone: (result: AttemptResult, questions: QuestionPublic[]) => void }) {
  const router = useRouter();
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [timers, setTimers] = useState<Record<string, number>>({});
  const [elapsed, setElapsed] = useState(0);
  const [reviewing, setReviewing] = useState(false);
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
    onSuccess: (result) => onDone(result, test?.questions || []),
    onError: () => toast.error("Submission failed"),
  });

  useEffect(() => { startMutation.mutate(); }, [testId]);

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  if (!test || !attemptId) return <Loader label="Loading test" />;

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

  const unanswered = questions.map((x, i) => ({ id: x.id, n: i + 1 })).filter((x) => !answers[x.id]?.length);
  const answered = questions.length - unanswered.length;

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="sticky top-14 md:top-0 z-20 -mx-4 px-4 md:-mx-8 md:px-8 py-3 mb-4 bg-[#f6f8fc]/95 backdrop-blur flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-gray-800 truncate">{test.name}</h2>
          <p className="text-xs text-gray-500 mb-1.5">Question {currentQ + 1} of {questions.length} · {answered} answered</p>
          <ProgressBar value={(answered / questions.length) * 100} color="#6366f1" className="!h-1.5" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1.5 text-sm font-mono bg-gray-100 px-3 py-1.5 rounded-lg">
            <Clock size={14} /> {formatTime(elapsed)}
          </span>
          <button
            onClick={() => setReviewing(true)}
            className="btn-primary text-sm"
            disabled={submitMutation.isPending}
          >
            Submit
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
              "w-9 h-9 rounded-lg text-xs font-medium transition-all active:scale-90",
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
      <div key={q.id} className="card mb-4 animate-in">
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
                "w-full text-left flex items-start gap-3 p-3.5 rounded-xl border transition-all active:scale-[.99]",
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
        {currentQ === questions.length - 1 ? (
          <button onClick={() => setReviewing(true)} className="btn-primary flex items-center gap-2">
            Review & submit <ChevronRight size={16} />
          </button>
        ) : (
          <button onClick={() => goTo(currentQ + 1)} className="btn-primary flex items-center gap-2">
            Next <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* Review before submitting */}
      {reviewing && (
        <Modal onClose={() => !submitMutation.isPending && setReviewing(false)}>
          <h3 className="text-lg font-semibold text-gray-900">Submit this test?</h3>
          <p className="text-sm text-gray-500 mt-1">You cannot change answers after submitting.</p>
          <div className="grid grid-cols-3 gap-2 text-center my-4">
            <div className="rounded-xl bg-green-50 py-3"><p className="text-xl font-bold text-green-600">{answered}</p><p className="text-xs text-gray-500">answered</p></div>
            <div className={clsx("rounded-xl py-3", unanswered.length ? "bg-amber-50" : "bg-gray-50")}>
              <p className={clsx("text-xl font-bold", unanswered.length ? "text-amber-600" : "text-gray-400")}>{unanswered.length}</p><p className="text-xs text-gray-500">unanswered</p>
            </div>
            <div className="rounded-xl bg-gray-50 py-3"><p className="text-xl font-bold text-gray-700 font-mono">{formatTime(elapsed)}</p><p className="text-xs text-gray-500">time</p></div>
          </div>
          {unanswered.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">Unanswered. Tap a number to go back to it.</p>
              <div className="flex flex-wrap gap-1.5">
                {unanswered.map((x) => (
                  <button key={x.id} onClick={() => { goTo(x.n - 1); setReviewing(false); }}
                    className="w-9 h-9 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">{x.n}</button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button className="btn-secondary flex-1" onClick={() => setReviewing(false)} disabled={submitMutation.isPending}>Keep going</button>
            <button className="btn-primary flex-1" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? "Submitting…" : "Submit test"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Result screen ───────────────────────────────────────
function ResultScreen({ result, questions, onRetry }: { result: AttemptResult; questions: QuestionPublic[]; onRetry: () => void }) {
  const [onlyMistakes, setOnlyMistakes] = useState(false);
  const router = useRouter();
  const pct = result.percentage;
  const color = pct >= 75 ? "text-green-600" : pct >= 50 ? "text-yellow-600" : "text-red-600";
  const bg = pct >= 75 ? "bg-green-50" : pct >= 50 ? "bg-yellow-50" : "bg-red-50";

  return (
    <div className="max-w-2xl mx-auto">
      <div className={`card relative overflow-hidden flex flex-col items-center text-center mb-6 ${bg} border-0 animate-in`}>
        {pct >= 75 && <Confetti />}
        <h2 className="text-lg font-bold text-gray-800 mb-3">{result.test_name}</h2>
        <Ring size={132} stroke={11} value={pct}>
          <span className={`text-3xl font-bold ${color}`}><CountUp value={Math.round(pct)} suffix="%" /></span>
          <span className="text-[11px] text-gray-500">{result.score} / {result.max_score} marks</span>
        </Ring>
        <p className="text-sm text-gray-600 mt-3">
          {pct >= 75 ? "Great work! This one is cleared." : pct >= 60 ? "Good. Review the mistakes below to lock it in." : "Go through the explanations below, then attempt it again."}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 stagger">
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
        <button onClick={onRetry} className="btn-primary flex-1 flex items-center justify-center gap-2"><RotateCcw size={15} /> Attempt again</button>
        <button onClick={() => router.push("/analytics")} className="btn-secondary flex-1 flex items-center justify-center gap-2"><BarChart2 size={15} /> Analytics</button>
      </div>

      {/* Answer review: the question, every option, what you chose and why */}
      <div className="card">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Lightbulb size={17} className="text-amber-500" /> Learn from this attempt</h3>
          {result.wrong_count + result.unattempted_count > 0 && (
            <button onClick={() => setOnlyMistakes(!onlyMistakes)}
              className={clsx("text-xs font-medium px-3 py-1.5 rounded-full border transition-colors shrink-0",
                onlyMistakes ? "bg-gray-900 border-gray-900 text-white" : "bg-white border-gray-200 text-gray-600")}>
              Only mistakes
            </button>
          )}
        </div>
        <div className="space-y-4 stagger">
          {result.answers.map((a, i) => ({ a, i })).filter(({ a }) => !onlyMistakes || !a.is_correct).map(({ a, i }) => {
            const q = questions.find((x) => x.id === a.question_id);
            const skipped = a.selected_options.length === 0;
            return (
              <div key={a.question_id} className={clsx("p-3.5 sm:p-4 rounded-2xl border", a.is_correct ? "border-green-100 bg-green-50/50" : skipped ? "border-gray-100 bg-gray-50" : "border-red-100 bg-red-50/40")}>
                <div className="flex items-center gap-2 mb-2">
                  {a.is_correct ? <CheckCircle2 size={16} className="text-green-600" /> : skipped ? <AlertCircle size={16} className="text-gray-400" /> : <XCircle size={16} className="text-red-500" />}
                  <span className="text-xs font-medium text-gray-500">Q{i + 1} · {a.is_correct ? "Correct" : skipped ? "Skipped" : "Wrong"}</span>
                  <span className={clsx("text-xs font-semibold ml-auto", a.marks_awarded > 0 ? "text-green-700" : a.marks_awarded < 0 ? "text-red-700" : "text-gray-400")}>
                    {a.marks_awarded > 0 ? "+" : ""}{a.marks_awarded}
                  </span>
                </div>
                {q ? (
                  <>
                    <p className="text-sm font-medium text-gray-800 mb-2.5 leading-relaxed">{q.text}</p>
                    <div className="space-y-1.5">
                      {q.options.map((o) => {
                        const right = a.correct_options.includes(o.id);
                        const chosen = a.selected_options.includes(o.id);
                        return (
                          <div key={o.id} className={clsx("flex items-start gap-2 text-sm rounded-lg px-2.5 py-1.5 border",
                            right ? "bg-green-50 border-green-200 text-green-800" : chosen ? "bg-red-50 border-red-200 text-red-700" : "bg-white border-gray-100 text-gray-600")}>
                            <span className="font-semibold uppercase shrink-0">{o.id}.</span>
                            <span className="flex-1 min-w-0 break-words">{o.text}</span>
                            <span className="text-[11px] font-medium shrink-0 mt-0.5">{right && chosen ? "your answer ✓" : right ? "correct" : chosen ? "your answer" : ""}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-gray-600">
                    Correct: <span className="text-green-700 font-medium">{a.correct_options.join(", ")}</span>
                    {!skipped && !a.is_correct && <> · Your answer: <span className="text-red-600 font-medium">{a.selected_options.join(", ")}</span></>}
                  </p>
                )}
                {a.explanation && (
                  <p className="flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2.5">
                    <Lightbulb size={15} className="text-amber-500 shrink-0 mt-0.5" /> <span>{a.explanation}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────
function AttemptFlow() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [testId, setTestId] = useState<string | null>(searchParams.get("test_id"));
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [questions, setQuestions] = useState<QuestionPublic[]>([]);
  const [key, setKey] = useState(0);

  const handleRetry = () => { setResult(null); setKey(k => k + 1); };

  return (
    <AppLayout>
      {!testId && <TestSelector onSelect={setTestId} />}
      {testId && !result && (
        <TestAttempt
          key={`${testId}-${key}`}
          testId={testId}
          // a finished attempt changes scores, streaks and weak areas everywhere
          onDone={(r, qs) => { setResult(r); setQuestions(qs); qc.invalidateQueries(); }}
        />
      )}
      {result && <ResultScreen result={result} questions={questions} onRetry={handleRetry} />}
    </AppLayout>
  );
}

// useSearchParams needs a Suspense boundary for the production build
export default function AttemptPage() {
  return (
    <Suspense fallback={<Loader label="Loading test" />}>
      <AttemptFlow />
    </Suspense>
  );
}
