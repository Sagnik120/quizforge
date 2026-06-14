"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<{
    email: string; username: string; password: string; full_name: string;
  }>();

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const res = await authApi.register(data);
      setAuth(res.data.access_token, res.data.user);
      toast.success("Account created! Let's start forging");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">QuizForge</h1>
        <p className="text-gray-500 text-sm mb-8">Create your account and start practicing</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input className="input" {...register("full_name")} placeholder="Optional" />
          </div>
          <div>
            <label className="label">Username</label>
            <input className="input" {...register("username", { required: "Username required" })} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" {...register("email", { required: "Email required" })} />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" {...register("password", { required: "Password required", minLength: { value: 6, message: "Min 6 chars" } })} />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>
          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-primary-600 hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
