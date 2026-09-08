"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, BookOpen, PenSquare, BarChart2,
  User, Repeat, Flame, FolderOpen, Target, CalendarDays,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { overviewApi } from "@/lib/api";
import { Avatar } from "@/components/ui";
import { clsx } from "clsx";

const nav = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/subjects", icon: FolderOpen, label: "Subjects & Topics" },
  { href: "/tests", icon: BookOpen, label: "Tests" },
  { href: "/tests/new", icon: PenSquare, label: "Create Test" },
  { href: "/goals", icon: Target, label: "Goals" },
  { href: "/calendar", icon: CalendarDays, label: "Calendar" },
  { href: "/analytics", icon: BarChart2, label: "Analytics" },
  { href: "/profile", icon: User, label: "Profile" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const { data: overview } = useQuery({ queryKey: ["overview"], queryFn: () => overviewApi.get().then((r) => r.data) });
  const me = overview?.people?.find((p: any) => p.is_me);
  const name = user?.full_name || user?.username || "";

  const switchUser = () => {
    clearAuth();
    router.push("/auth/login");
  };

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-100 flex flex-col">
      <div className="px-6 py-5 border-b border-gray-100">
        <h1 className="text-xl font-bold text-primary-600">🎯 PrepDuo</h1>
        <p className="text-xs text-gray-500 mt-0.5">Placement prep, together</p>
      </div>

      <div className="px-6 py-3 bg-orange-50 flex items-center gap-2 border-b border-orange-100">
        <span className={clsx(me?.current_streak > 0 && "flame")}><Flame size={16} className="text-orange-500" /></span>
        <span className="text-sm text-orange-700 font-medium">{me?.current_streak ?? 0} day streak</span>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {nav.map(({ href, icon: Icon, label }) => {
          // "/tests" must not light up while on "/tests/new"
          const active = href === "/tests" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover:translate-x-0.5",
                active ? "bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <Avatar name={name || "U"} username={user?.username || ""} />
          <p className="text-sm font-medium text-gray-800 truncate">{name}</p>
        </div>
        <button
          onClick={switchUser}
          className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-primary-600 transition-colors py-1.5 px-2 rounded-lg hover:bg-primary-50"
        >
          <Repeat size={16} /> Switch user
        </button>
      </div>
    </aside>
  );
}
