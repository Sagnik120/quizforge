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
