"use client";
import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { subjectsApi, testsApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, FileJson, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { Subject } from "@/types";
import { clsx } from "clsx";

interface OptionForm { id: string; text: string; is_correct: boolean; }
interface QuestionForm {
  question_type: "MCQ" | "MSQ";
  text: string;
  options: OptionForm[];
  explanation: string;
  marks: number;
  negative_marks: number;
}

const defaultQuestion = (): QuestionForm => ({
  question_type: "MCQ", text: "", explanation: "", marks: 1, negative_marks: 0,
  options: [
    { id: "a", text: "", is_correct: false },
    { id: "b", text: "", is_correct: false },
    { id: "c", text: "", is_correct: false },
    { id: "d", text: "", is_correct: false },
  ],
});

const EXAMPLE_JSON = `{
  "name": "My Test Name",
  "description": "Optional description",
  "time_limit_minutes": 30,
  "questions": [
    {
      "question_type": "MCQ",
      "text": "Your question here?",
      "options": [
        { "id": "a", "text": "Option A", "is_correct": false },
        { "id": "b", "text": "Option B", "is_correct": true },
        { "id": "c", "text": "Option C", "is_correct": false },
        { "id": "d", "text": "Option D", "is_correct": false }
      ],
      "explanation": "Why B is correct (optional)",
      "marks": 2,
      "negative_marks": 0
    },
    {
      "question_type": "MSQ",
      "text": "Select ALL correct options",
      "options": [
        { "id": "a", "text": "Correct one", "is_correct": true },
        { "id": "b", "text": "Wrong one",   "is_correct": false },
        { "id": "c", "text": "Correct two", "is_correct": true },
        { "id": "d", "text": "Wrong two",   "is_correct": false }
      ],
      "marks": 3,
      "negative_marks": 1
    }
  ]
}`;

// ─── Shared topic selector ────────────────────────────────
function TopicSelector({
  subjects, subjectId, topicId, onSubjectChange, onTopicChange,
}: {
  subjects: Subject[];
  subjectId: string;
  topicId: string;
  onSubjectChange: (id: string) => void;
  onTopicChange: (id: string) => void;
}) {
  const selectedSubject = subjects.find(s => s.id === subjectId);
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="label">Subject *</label>
        <select className="input" value={subjectId} onChange={e => { onSubjectChange(e.target.value); onTopicChange(""); }}>
          <option value="">Select subject</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name} ({s.space})</option>)}
        </select>
      </div>
      <div>
        <label className="label">Topic / sub-topic *</label>
        <select className="input" value={topicId} onChange={e => onTopicChange(e.target.value)} disabled={!subjectId}>
          <option value="">Select topic</option>
          {selectedSubject?.topics.filter(t => !t.parent_id).flatMap(t => [
            <option key={t.id} value={t.id}>{t.name}</option>,
            ...selectedSubject.topics.filter(k => k.parent_id === t.id).map(k => (
              <option key={k.id} value={k.id}>&nbsp;&nbsp;↳ {k.name}</option>
            )),
          ])}
        </select>
        {subjectId && selectedSubject?.topics.length === 0 && (
          <p className="text-xs text-orange-500 mt-1">No topics yet — add one in Subjects page first.</p>
        )}
      </div>
    </div>
  );
}

// ─── JSON Import tab ──────────────────────────────────────
function JSONImportTab({ subjects }: { subjects: Subject[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [parseError, setParseError] = useState("");
  const [pasted, setPasted] = useState("");

  const handlePaste = (text: string) => {
    setPasted(text);
    setSelectedFile(null);
    setParseError("");
    setPreview(null);
    if (!text.trim()) return;
    try {
      setPreview(JSON.parse(text));
    } catch {
      setParseError("That is not valid JSON yet — check for a missing comma, quote or bracket.");
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setPasted("");
    setParseError("");
    setPreview(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        setPreview(JSON.parse(e.target?.result as string));
      } catch {
        setParseError("Invalid JSON file — could not parse.");
      }
    };
    reader.readAsText(file);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const text = selectedFile ? await selectedFile.text() : pasted;
      return testsApi.create({ ...JSON.parse(text), topic_id: topicId });
    },
    onSuccess: () => { toast.success("Test imported successfully!"); router.push("/tests"); },
    onError: (e: any) => {
      const detail = e.response?.data?.detail;
      // Validation errors arrive as a list of {loc, msg}; show the first one readably
      toast.error(Array.isArray(detail) ? `${detail[0].loc.slice(1).join(" › ")}: ${detail[0].msg}` : detail || "Import failed — check your JSON format");
    },
  });

  const canImport = topicId && preview && !parseError;

  return (
    <div className="space-y-4">
      {/* Step 1 */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-primary-500 text-white text-xs flex items-center justify-center font-bold">1</span>
          <h3 className="font-semibold text-gray-800">Choose where to save this test</h3>
        </div>
        <TopicSelector subjects={subjects} subjectId={subjectId} topicId={topicId} onSubjectChange={setSubjectId} onTopicChange={setTopicId} />
      </div>

      {/* Step 2 */}
      <div className={clsx("card transition-all", !topicId && "opacity-50 pointer-events-none")}>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-primary-500 text-white text-xs flex items-center justify-center font-bold">2</span>
          <h3 className="font-semibold text-gray-800">Upload a JSON file or paste JSON</h3>
        </div>
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
          className={clsx(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
            selectedFile ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-primary-400 hover:bg-primary-50"
          )}
        >
          {selectedFile ? (
            <div className="flex items-center justify-center gap-3">
              <CheckCircle2 className="text-green-500" size={24} />
              <div className="text-left">
                <p className="font-medium text-green-700">{selectedFile.name}</p>
                <p className="text-xs text-green-600">{preview ? `${preview.questions?.length ?? 0} questions detected` : ""}</p>
              </div>
              <button onClick={e => { e.stopPropagation(); setSelectedFile(null); setPreview(null); }} className="ml-4 text-xs text-gray-400 hover:text-red-500">Remove</button>
            </div>
          ) : (
            <>
              <FileJson className="mx-auto mb-2 text-gray-300" size={36} />
              <p className="text-sm text-gray-500">Click to upload or drag & drop a JSON file</p>
              <p className="text-xs text-gray-400 mt-1">No need to include topic_id — it's set from the dropdown above</p>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }} />
        <div className="flex items-center justify-between mt-4 mb-1">
          <label className="label !mb-0" htmlFor="json-paste">…or paste JSON here</label>
          <button type="button" className="text-xs text-primary-600 hover:underline" onClick={() => handlePaste(EXAMPLE_JSON)}>Fill with example</button>
        </div>
        <textarea id="json-paste" className="input font-mono !text-xs resize-y" rows={8} spellCheck={false}
          value={pasted} onChange={e => handlePaste(e.target.value)} placeholder='{ "name": "My test", "questions": [ ... ] }' />
        {parseError && <p className="text-red-500 text-sm mt-2">{parseError}</p>}
      </div>

      {/* Step 3 */}
      {preview && !parseError && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-primary-500 text-white text-xs flex items-center justify-center font-bold">3</span>
            <h3 className="font-semibold text-gray-800">Preview & Import</h3>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-1 text-sm">
            <p><span className="text-gray-500">Test name:</span> <span className="font-medium text-gray-800">{preview.name || "—"}</span></p>
            <p><span className="text-gray-500">Description:</span> <span className="text-gray-700">{preview.description || "None"}</span></p>
            <p><span className="text-gray-500">Questions:</span> <span className="font-medium text-gray-800">{preview.questions?.length ?? 0}</span></p>
            <p><span className="text-gray-500">Time limit:</span> <span className="text-gray-700">{preview.time_limit_minutes ? `${preview.time_limit_minutes} min` : "No limit"}</span></p>
            {preview.questions?.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-gray-500 mb-1">Question types:</p>
                <div className="flex gap-2">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">MCQ: {preview.questions.filter((q: any) => q.question_type === "MCQ").length}</span>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">MSQ: {preview.questions.filter((q: any) => q.question_type === "MSQ").length}</span>
                </div>
              </div>
            )}
          </div>
          <button className="btn-primary w-full" onClick={() => importMutation.mutate()} disabled={!canImport || importMutation.isPending}>
            {importMutation.isPending ? "Importing..." : `Import Test (${preview.questions?.length ?? 0} questions)`}
          </button>
        </div>
      )}

      {/* JSON format reference */}
      <details className="card cursor-pointer">
        <summary className="font-medium text-gray-700 text-sm select-none">View expected JSON format</summary>
        <pre className="mt-3 text-xs bg-gray-50 rounded-lg p-4 overflow-auto text-gray-600 leading-relaxed">
{EXAMPLE_JSON}
        </pre>
        <p className="text-xs text-green-600 mt-2">✓ No need to include <code>topic_id</code> — you select it from the dropdown above.</p>
      </details>
    </div>
  );
}

// ─── Manual entry tab ─────────────────────────────────────
function ManualEntryTab({ subjects }: { subjects: Subject[] }) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [testName, setTestName] = useState("");
  const [testDesc, setTestDesc] = useState("");
  const [timeLimit, setTimeLimit] = useState("");
  const [questions, setQuestions] = useState<QuestionForm[]>([defaultQuestion()]);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const createTest = useMutation({
    mutationFn: () => testsApi.create({
      name: testName,
      description: testDesc,
      topic_id: topicId,
      time_limit_minutes: timeLimit ? parseInt(timeLimit) : null,
      questions: questions.map((q, i) => ({ ...q, order_index: i })),
    }),
    onSuccess: () => { toast.success("Test created!"); router.push("/tests"); },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Failed to create test"),
  });

  const updateQuestion = (i: number, field: string, value: any) =>
    setQuestions(qs => qs.map((q, idx) => idx === i ? { ...q, [field]: value } : q));

  const updateOption = (qi: number, oi: number, field: string, value: any) =>
    setQuestions(qs => qs.map((q, idx) => {
      if (idx !== qi) return q;
      const opts = q.options.map((o, oidx) => {
        if (oidx !== oi) return (field === "is_correct" && q.question_type === "MCQ" && value) ? { ...o, is_correct: false } : o;
        return { ...o, [field]: value };
      });
      return { ...q, options: opts };
    }));

  const toggleCollapse = (i: number) =>
    setCollapsed(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  // ── Validation ──────────────────────────────────────────
  const questionsValid = questions.every(q => {
    const hasText = q.text.trim().length > 0;
    const correctCount = q.options.filter(o => o.is_correct).length;
    const hasCorrect = q.question_type === "MCQ" ? correctCount === 1 : correctCount >= 2;
    const allOptionsFilled = q.options.every(o => o.text.trim().length > 0);
    return hasText && hasCorrect && allOptionsFilled;
  });

  const buttonLabel = () => {
    if (createTest.isPending) return "Creating...";
    if (!testName) return "⚠ Enter a test name first";
    if (!topicId) return "⚠ Select a topic first";
    if (!questionsValid) return "⚠ Fill all questions & mark correct answers";
    return `Create Test (${questions.length} question${questions.length > 1 ? "s" : ""})`;
  };

  return (
    <div className="space-y-4">
      {/* Test details */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-800">Test Details</h2>
        <div>
          <label className="label">Test Name *</label>
          <input className="input" value={testName} onChange={e => setTestName(e.target.value)} placeholder="e.g. Newton's Laws MCQ" />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input resize-none" rows={2} value={testDesc} onChange={e => setTestDesc(e.target.value)} placeholder="Optional description" />
        </div>
        <TopicSelector subjects={subjects} subjectId={subjectId} topicId={topicId} onSubjectChange={setSubjectId} onTopicChange={setTopicId} />
        <div>
          <label className="label">Time Limit (minutes)</label>
          <input className="input" type="number" min={1} value={timeLimit} onChange={e => setTimeLimit(e.target.value)} placeholder="Leave empty for no limit" />
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q, qi) => (
          <div key={qi} className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-gray-700 text-sm">Question {qi + 1}</span>
              <div className="flex gap-2 items-center">
                <select
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                  value={q.question_type}
                  onChange={e => updateQuestion(qi, "question_type", e.target.value as "MCQ" | "MSQ")}
                >
                  <option value="MCQ">MCQ — single correct</option>
                  <option value="MSQ">MSQ — multiple correct</option>
                </select>
                <button onClick={() => toggleCollapse(qi)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
                  {collapsed.has(qi) ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
                {questions.length > 1 && (
                  <button onClick={() => setQuestions(qs => qs.filter((_, i) => i !== qi))} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>

            {!collapsed.has(qi) && (
              <>
                <textarea
                  className="input resize-none mb-4"
                  rows={2}
                  placeholder="Question text..."
                  value={q.text}
                  onChange={e => updateQuestion(qi, "text", e.target.value)}
                />

                <p className="text-xs text-gray-400 mb-2">
                  {q.question_type === "MCQ"
                    ? "🔘 Select the ONE correct answer"
                    : "☑ Select ALL correct answers (minimum 2)"}
                </p>

                <div className="space-y-2 mb-4">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        type={q.question_type === "MCQ" ? "radio" : "checkbox"}
                        name={`q${qi}-correct`}
                        checked={opt.is_correct}
                        onChange={e => updateOption(qi, oi, "is_correct", e.target.checked)}
                        className="w-4 h-4 text-primary-600 shrink-0"
                      />
                      <span className="text-xs text-gray-400 font-medium w-4">{opt.id}.</span>
                      <input
                        className={clsx("input flex-1 text-sm py-1.5", opt.is_correct && "border-green-400 bg-green-50")}
                        placeholder={`Option ${opt.id}`}
                        value={opt.text}
                        onChange={e => updateOption(qi, oi, "text", e.target.value)}
                      />
                      {q.options.length > 2 && (
                        <button onClick={() => updateQuestion(qi, "options", q.options.filter((_, i) => i !== oi))} className="p-1 text-gray-400 hover:text-red-500">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const nextId = String.fromCharCode(97 + q.options.length);
                      updateQuestion(qi, "options", [...q.options, { id: nextId, text: "", is_correct: false }]);
                    }}
                    className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 mt-1 px-1"
                  >
                    <Plus size={12} /> Add option
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label text-xs">Marks</label>
                    <input type="number" className="input text-sm" min={1} value={q.marks} onChange={e => updateQuestion(qi, "marks", parseInt(e.target.value) || 1)} />
                  </div>
                  <div>
                    <label className="label text-xs">Negative marks</label>
                    <input type="number" className="input text-sm" min={0} value={q.negative_marks} onChange={e => updateQuestion(qi, "negative_marks", parseInt(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="label text-xs">Explanation (optional)</label>
                    <input className="input text-sm" value={q.explanation} onChange={e => updateQuestion(qi, "explanation", e.target.value)} placeholder="Why is this the answer?" />
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <button onClick={() => setQuestions(qs => [...qs, defaultQuestion()])} className="btn-secondary w-full flex items-center justify-center gap-2">
        <Plus size={16} /> Add Question
      </button>

      <button
        className="btn-primary w-full text-base py-3"
        onClick={() => createTest.mutate()}
        disabled={createTest.isPending || !testName || !topicId || !questionsValid}
      >
        {buttonLabel()}
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────
export default function NewTestPage() {
  const [tab, setTab] = useState<"manual" | "json">("manual");

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["subjects"],
    queryFn: () => subjectsApi.list().then(r => r.data),
  });

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Create New Test</h1>
          <p className="text-gray-500 mt-1">Fill the form, paste JSON, or upload a JSON file. Pick a common subject to share the test.</p>
        </div>

        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setTab("manual")}
            className={clsx("px-5 py-2 rounded-lg text-sm font-medium transition-colors", tab === "manual" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}
          >
            Manual Entry
          </button>
          <button
            onClick={() => setTab("json")}
            className={clsx("px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2", tab === "json" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}
          >
            <FileJson size={15} /> Import JSON
          </button>
        </div>

        {tab === "manual" && <ManualEntryTab subjects={subjects} />}
        {tab === "json" && <JSONImportTab subjects={subjects} />}
      </div>
    </AppLayout>
  );
}