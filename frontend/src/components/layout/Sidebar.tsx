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
