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
