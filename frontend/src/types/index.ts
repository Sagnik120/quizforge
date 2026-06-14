export interface Subject {
  id: string;
  name: string;
  description?: string;
  color: string;
  owner_id: string;
  created_at: string;
  topics: Topic[];
}

export interface Topic {
  id: string;
  name: string;
  description?: string;
  subject_id: string;
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
  selected_options: string[];
  correct_options: string[];
  is_correct: boolean;
  marks_awarded: number;
  explanation?: string;
}

export interface AttemptResult {
  id: string;
  test_id: string;
  test_name: string;
  score: number;
  max_score: number;
  percentage: number;
  correct_count: number;
  wrong_count: number;
  unattempted_count: number;
  time_taken_seconds?: number;
  completed_at: string;
  answers: AnswerResult[];
}

export interface RevisionItem {
  id: string;
  question_id: string;
  question_text: string;
  question_type: QuestionType;
  test_name: string;
  topic_name: string;
  subject_name: string;
  wrong_count: number;
  last_wrong_at: string;
  is_resolved: boolean;
}

export interface AnalyticsSummary {
  total_attempts: number;
  total_tests_attempted: number;
  average_percentage: number;
  best_percentage: number;
  total_time_spent_hours: number;
  current_streak: number;
  longest_streak: number;
  weak_topics: { topic_name: string; avg_score: number }[];
  recent_performance: { date: string; percentage: number }[];
  accuracy_by_question_type: { MCQ: number; MSQ: number };
}
