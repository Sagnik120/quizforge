import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
});

// Attach token from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("quizforge_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const isAuthCall = error.config?.url?.startsWith("/auth/");
    if (error.response?.status === 401 && !isAuthCall && typeof window !== "undefined") {
      localStorage.removeItem("quizforge_token");
      localStorage.removeItem("quizforge-auth");
      window.location.href = "/auth/login";
    }
    return Promise.reject(error);
  }
);

// ─── Auth ──────────────────────────────────────────────
export const authApi = {
  people: () => api.get("/auth/users"),
  quickLogin: (username: string, passcode = "") =>
    api.post("/auth/quick-login", { username, passcode }),
};

// ─── Subjects & Topics ─────────────────────────────────
export const subjectsApi = {
  list: () => api.get("/subjects/"),
  create: (data: any) => api.post("/subjects/", data),
  update: (id: string, data: any) => api.put(`/subjects/${id}`, data),
  delete: (id: string) => api.delete(`/subjects/${id}`),
  createTopic: (subjectId: string, data: any) =>
    api.post(`/subjects/${subjectId}/topics`, data),
  updateTopic: (subjectId: string, topicId: string, data: any) =>
    api.put(`/subjects/${subjectId}/topics/${topicId}`, data),
  deleteTopic: (subjectId: string, topicId: string) =>
    api.delete(`/subjects/${subjectId}/topics/${topicId}`),
};

// ─── Tests ─────────────────────────────────────────────
export const testsApi = {
  list: (params?: { topic_id?: string; subject_id?: string; space?: string }) =>
    api.get("/tests/", { params }),
  create: (data: any) => api.post("/tests/", data),
  importJSON: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/tests/import-json", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  get: (id: string) => api.get(`/tests/${id}`),
  getForAttempt: (id: string) => api.get(`/tests/${id}/attempt-view`),
  delete: (id: string) => api.delete(`/tests/${id}`),
  exampleJSON: () => api.get("/tests/example-json"),
};

// ─── Attempts ──────────────────────────────────────────
export const attemptsApi = {
  start: (testId: string) => api.post("/attempts/start", { test_id: testId }),
  submit: (attemptId: string, answers: any[]) =>
