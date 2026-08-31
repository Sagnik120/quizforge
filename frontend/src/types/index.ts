export type Space = "private" | "common";

export interface Subject {
  id: string;
  name: string;
  description?: string;
  color: string;
  owner_id: string;
  space: Space;
  created_at: string;
  topics: Topic[];
}

export interface Topic {
  id: string;
  name: string;
  description?: string;
  subject_id: string;
  parent_id?: string | null;
  created_at: string;
}

export interface Option {
  id: string;
  text: string;
  is_correct?: boolean;
}

export type QuestionType = "MCQ" | "MSQ";

export interface Question {
  id: string;
  test_id: string;
  question_type: QuestionType;
  text: string;
  options: Option[];
  explanation?: string;
  marks: number;
  negative_marks: number;
  order_index: number;
}

export interface QuestionPublic {
  id: string;
  question_type: QuestionType;
  text: string;
  options: { id: string; text: string }[];
  marks: number;
  negative_marks: number;
  order_index: number;
}

export interface Test {
  id: string;
  name: string;
  description?: string;
  topic_id: string;
  creator_id: string;
  time_limit_minutes?: number;
  is_published: boolean;
  total_questions: number;
  total_marks: number;
  created_at: string;
  questions?: Question[];
}

export interface Attempt {
  id: string;
  test_id: string;
  test_name: string;
  score: number;
  max_score: number;
  percentage: number;
  status: "in_progress" | "completed" | "abandoned";
  started_at: string;
  completed_at?: string;
}

export interface AnswerResult {
  question_id: string;
