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
