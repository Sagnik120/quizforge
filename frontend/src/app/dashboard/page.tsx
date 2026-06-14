"use client";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi, leaderboardApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuthStore } from "@/lib/store";
import { BookOpen, Target, Clock, Flame, Trophy, TrendingUp } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data: analytics } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => analyticsApi.summary().then(r => r.data),
  });

  const stats = [
    { label: "Total Attempts", value: analytics?.total_attempts ?? "—", icon: Target, color: "text-blue-600 bg-blue-50" },
    { label: "Tests Practiced", value: analytics?.total_tests_attempted ?? "—", icon: BookOpen, color: "text-green-600 bg-green-50" },
    { label: "Best Score", value: analytics?.best_percentage ? `${analytics.best_percentage}%` : "—", icon: Trophy, color: "text-yellow-600 bg-yellow-50" },
    { label: "Hours Studied", value: analytics?.total_time_spent_hours ?? "—", icon: Clock, color: "text-purple-600 bg-purple-50" },
    { label: "Current Streak", value: `${user?.current_streak ?? 0} days`, icon: Flame, color: "text-orange-600 bg-orange-50" },
    { label: "Avg Score", value: analytics?.average_percentage ? `${analytics.average_percentage}%` : "—", icon: TrendingUp, color: "text-indigo-600 bg-indigo-50" },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.full_name || user?.username} 👋
          </h1>
          <p className="text-gray-500 mt-1">Here's your performance overview</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card flex items-center gap-4">
              <div className={`p-3 rounded-xl ${color}`}>
                <Icon size={22} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-sm text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link href="/tests/new" className="card hover:border-primary-200 hover:shadow-md transition-all cursor-pointer">
            <h3 className="font-semibold text-gray-800 mb-1">Create Test</h3>
            <p className="text-sm text-gray-500">Add questions manually or import JSON</p>
          </Link>
          <Link href="/attempt" className="card hover:border-primary-200 hover:shadow-md transition-all cursor-pointer">
            <h3 className="font-semibold text-gray-800 mb-1">Attempt a Test</h3>
            <p className="text-sm text-gray-500">Practice and track your score</p>
          </Link>
          <Link href="/analytics" className="card hover:border-primary-200 hover:shadow-md transition-all cursor-pointer">
            <h3 className="font-semibold text-gray-800 mb-1">Review Weak Areas</h3>
            <p className="text-sm text-gray-500">
              {analytics?.weak_topics?.length ?? 0} topics need attention
            </p>
          </Link>
        </div>

        {/* Weak topics */}
        {analytics?.weak_topics?.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Weak Topics</h2>
            <div className="space-y-3">
              {analytics.weak_topics.map((t: any) => (
                <div key={t.topic_name} className="flex items-center gap-4">
                  <span className="text-sm text-gray-700 w-40 truncate">{t.topic_name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-red-400 h-2 rounded-full"
                      style={{ width: `${t.avg_score}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-red-600 w-12 text-right">
                    {t.avg_score}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
