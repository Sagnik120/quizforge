"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, BookOpen, PenSquare, BarChart2,
  User, Repeat, Flame, FolderOpen, Target, CalendarDays, Menu, X,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { overviewApi } from "@/lib/api";
import { Avatar, displayName } from "@/components/ui";
import { clsx } from "clsx";

const nav = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", short: "Today" },
  { href: "/tests", icon: BookOpen, label: "Tests", short: "Tests" },
  { href: "/goals", icon: Target, label: "Goals", short: "Goals" },
  { href: "/calendar", icon: CalendarDays, label: "Calendar", short: "Calendar" },
  { href: "/analytics", icon: BarChart2, label: "Analytics", short: "Analytics" },
  { href: "/subjects", icon: FolderOpen, label: "Subjects & Topics", short: "Subjects" },
  { href: "/tests/new", icon: PenSquare, label: "Create Test", short: "Create" },
  { href: "/profile", icon: User, label: "Profile", short: "Profile" },
];
// The phone tab bar holds the five everyday pages; the rest are in the menu
const tabs = nav.slice(0, 5);

// "/tests" must not light up while on "/tests/new"
const isActive = (href: string, pathname: string) =>
  href === "/tests" ? pathname === href : pathname.startsWith(href);

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: overview } = useQuery({ queryKey: ["overview"], queryFn: () => overviewApi.get().then((r) => r.data) });
  const me = overview?.people?.find((p: any) => p.is_me);
  const name = displayName(user?.username);
  const streak = me?.current_streak ?? 0;

  useEffect(() => { setOpen(false); }, [pathname]);

  const switchUser = () => {
    clearAuth();
    qc.clear(); // never keep one person's data around for the next
    router.push("/auth/login");
  };

  return (
    <>
      {/* Phone: top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-white/90 backdrop-blur border-b border-gray-100 flex items-center justify-between px-4">
        <Link href="/dashboard" className="text-lg font-bold text-primary-600">🎯 PrepDuo</Link>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 text-sm text-orange-700 font-semibold bg-orange-50 px-2.5 py-1 rounded-full">
            <span className={clsx(streak > 0 && "flame")}><Flame size={14} className="text-orange-500" /></span>{streak}
          </span>
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="p-2 -mr-2 rounded-lg text-gray-600 active:bg-gray-100">
            <Menu size={22} />
          </button>
        </div>
      </header>

      {open && <div className="md:hidden fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm fade" onClick={() => setOpen(false)} />}

      {/* Desktop: fixed sidebar. Phone: slide-in menu */}
      <aside className={clsx(
        "w-64 shrink-0 bg-white border-r border-gray-100 flex flex-col",
        "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out md:sticky md:top-0 md:h-screen md:translate-x-0",
        open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      )}>
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary-600">🎯 PrepDuo</h1>
            <p className="text-xs text-gray-500 mt-0.5">Placement prep, together</p>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close menu" className="md:hidden p-2 -mr-2 rounded-lg text-gray-500 active:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-3 bg-orange-50 flex items-center gap-2 border-b border-orange-100">
          <span className={clsx(streak > 0 && "flame")}><Flame size={16} className="text-orange-500" /></span>
          <span className="text-sm text-orange-700 font-medium">{streak} day streak</span>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {nav.map(({ href, icon: Icon, label }) => {
            const active = isActive(href, pathname);
            return (
              <Link key={href} href={href}
                className={clsx(
                  "group relative flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-xl text-sm font-medium transition-all hover:translate-x-0.5",
                  active ? "bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}>
                {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-primary-500" />}
                <Icon size={18} className="transition-transform group-hover:-rotate-12 group-hover:scale-110" />
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
          <button onClick={switchUser}
            className="w-full flex items-center gap-2 text-sm text-gray-500 hover:text-primary-600 transition-colors py-2 px-2 rounded-lg hover:bg-primary-50">
            <Repeat size={16} /> Switch user
          </button>
        </div>
      </aside>

      {/* Phone: bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-gray-100 grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ href, icon: Icon, short }) => {
          const active = isActive(href, pathname);
          return (
            <Link key={href} href={href}
              className={clsx("relative flex flex-col items-center justify-center gap-0.5 h-14 text-[11px] font-medium transition-colors",
                active ? "text-primary-600" : "text-gray-500")}>
              {active && <span className="absolute top-0 w-8 h-0.5 rounded-full bg-primary-500" />}
              <Icon size={20} strokeWidth={active ? 2.5 : 2} className={clsx("transition-transform", active && "-translate-y-0.5")} />
              {short}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
