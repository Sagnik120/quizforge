"use client";
import { PageHeader } from "@/components/ui";
import { UserRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { profileApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuthStore } from "@/lib/store";
import { toast } from "sonner";
import { User, Mail, Building2, FileText, Flame } from "lucide-react";

export default function ProfilePage() {
  const { updateUser } = useAuthStore();
  const qc = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => profileApi.get().then(r => r.data),
  });

  const { register, handleSubmit } = useForm({
    values: profile,
  });

  const mutation = useMutation({
    mutationFn: (data: any) => profileApi.update(data).then(r => r.data),
    onSuccess: (data) => {
      updateUser(data);
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated!");
    },
    onError: () => toast.error("Update failed"),
  });

  if (isLoading) return <AppLayout><div className="text-gray-500">Loading...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6"><PageHeader icon={UserRound} tint="bg-green-50 text-green-600" title="Profile" /></div>

        {/* Avatar + streak */}
        <div className="card mb-6 flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-3xl font-bold">
            {profile?.username?.[0]?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">{profile?.username}</h2>
            <p className="text-gray-500 text-sm">{profile?.email}</p>
            <div className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1 text-orange-600 text-sm font-medium">
                <Flame size={16} /> {profile?.current_streak} day streak
              </span>
              <span className="text-gray-400 text-sm">
                Best: {profile?.longest_streak} days
              </span>
            </div>
          </div>
        </div>

        {/* Edit form */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">Edit Profile</h2>
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div>
              <label className="label flex items-center gap-2"><User size={14} /> Full Name</label>
              <input className="input" {...register("full_name")} placeholder="Your full name" />
            </div>
            <div>
              <label className="label flex items-center gap-2"><Building2 size={14} /> Institution / School</label>
              <input className="input" {...register("institution")} placeholder="e.g. IIT Delhi, AIIMS, etc." />
            </div>
            <div>
              <label className="label flex items-center gap-2"><FileText size={14} /> Bio</label>
              <textarea
                className="input resize-none"
                rows={3}
                {...register("bio")}
                placeholder="Tell us about yourself..."
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Saving..." : "Update Profile"}
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
