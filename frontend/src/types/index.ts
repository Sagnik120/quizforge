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
