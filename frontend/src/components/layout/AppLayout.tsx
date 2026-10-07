"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { ConfirmHost, TopProgress } from "@/components/ui";
import { Sidebar } from "./Sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!token) router.push("/auth/login");
  }, [token, router]);

  if (!token) return null;

  return (
    <div className="flex min-h-screen">
      <TopProgress />
      <Sidebar />
      {/* phone: room for the fixed top bar and bottom tab bar */}
      <main key={pathname} className="flex-1 min-w-0 px-4 pt-[4.5rem] pb-28 md:p-8 animate-in">{children}</main>
      <ConfirmHost />
    </div>
  );
}
