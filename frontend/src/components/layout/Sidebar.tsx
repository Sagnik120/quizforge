"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, BookOpen, PenSquare, BarChart2,
  Trophy, User, LogOut, Flame, FolderOpen,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { clsx } from "clsx";

const nav = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/subjects", icon: FolderOpen, label: "Subjects & Topics" },
  { href: "/tests", icon: BookOpen, label: "My Tests" },
  { href: "/attempt", icon: PenSquare, label: "Attempt Test" },
  { href: "/analytics", icon: BarChart2, label: "Analytics" },
  { href: "/leaderboard", icon: Trophy, label: "Leaderboard" },
  { href: "/profile", icon: User, label: "Profile" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  const handleLogout = () => {
    clearAuth();
    router.push("/auth/login");
  };

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-100 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <h1 className="text-xl font-bold text-primary-600">⚡ QuizForge</h1>
        <p className="text-xs text-gray-500 mt-0.5">Master your exams</p>
      </div>

      {/* Streak badge */}
      {user && (
        <div className="px-6 py-3 bg-orange-50 flex items-center gap-2 border-b border-orange-100">
          <Flame size={16} className="text-orange-500" />
          <span className="text-sm text-orange-700 font-medium">
            {user.current_streak} day streak
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {nav.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              pathname.startsWith(href)
                ? "bg-primary-50 text-primary-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>

      {/* User + logout */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
            {user?.username?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{user?.username}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors py-1.5 px-2 rounded-lg hover:bg-red-50"
        >
          <LogOut size={16} /> Logout
        </button>
      </div>
    </aside>
  );
}
