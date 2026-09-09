"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Avatar, Loader } from "@/components/ui";

const PASSCODE_KEY = "prepduo-passcode";

export default function LoginPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { setAuth } = useAuthStore();
  const [entering, setEntering] = useState<string | null>(null);
  const [passcode, setPasscode] = useState("");

  useEffect(() => { setPasscode(localStorage.getItem(PASSCODE_KEY) || ""); }, []);

  // The free backend sleeps when idle, so keep retrying while it wakes up
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["people"],
    queryFn: () => authApi.people().then((r) => r.data),
    retry: 8,
    retryDelay: 5000,
  });

  const enter = async (username: string) => {
    setEntering(username);
    try {
      const res = await authApi.quickLogin(username, passcode);
      localStorage.setItem(PASSCODE_KEY, passcode);
      qc.clear(); // never show the previous person's cached data
      setAuth(res.data.access_token, res.data.user);
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Could not sign in");
      setEntering(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-pink-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md animate-in">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">🎯 PrepDuo</h1>
        <p className="text-gray-500 text-sm mb-8">Who is preparing today?</p>

        {isLoading ? (
          <Loader label="Waking the server up — the first load can take up to a minute" />
        ) : isError ? (
          <div className="text-center py-8">
            <p className="text-sm text-red-500 mb-3">Could not reach the server.</p>
            <button className="btn-secondary" onClick={() => refetch()}>Try again</button>
          </div>
