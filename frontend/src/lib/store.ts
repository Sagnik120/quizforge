import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  bio?: string;
  institution?: string;
  avatar_url?: string;
  current_streak: number;
  longest_streak: number;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => {
        localStorage.setItem("quizforge_token", token);
        set({ token, user });
      },
      clearAuth: () => {
        localStorage.removeItem("quizforge_token");
        set({ token: null, user: null });
      },
      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),
    }),
    { name: "quizforge-auth" }
  )
);
