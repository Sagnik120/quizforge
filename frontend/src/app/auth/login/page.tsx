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
