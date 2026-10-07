"use client";
import { useQuery } from "@tanstack/react-query";
import { leaderboardApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Trophy, TrendingUp, BarChart2, RefreshCw } from "lucide-react";
import { clsx } from "clsx";

export default function LeaderboardPage() {
  const { data: leaderboard = [], isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => leaderboardApi.get().then(r => r.data),
  });

  const getRankColor = (rank: number) =>
    rank === 0 ? "text-yellow-600 bg-yellow-50" :
    rank === 1 ? "text-gray-500 bg-gray-50" :
    rank === 2 ? "text-orange-600 bg-orange-50" :
    "text-gray-400 bg-gray-50";

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Personal Leaderboard</h1>
            <p className="text-gray-500 mt-1">Your best scores across all tests</p>
          </div>
          <Trophy className="text-yellow-500" size={40} />
        </div>

        {isLoading ? (
          <div className="card text-center text-gray-500 py-12">Loading...</div>
        ) : leaderboard.length === 0 ? (
          <div className="card text-center py-12">
            <Trophy className="mx-auto mb-4 text-gray-300" size={48} />
            <p className="text-gray-500">No attempts yet. Complete a test to see your ranking.</p>
          </div>
        ) : (
          <div className="card">
            <div className="space-y-3">
              {leaderboard.map((item: any, idx: number) => (
                <div
                  key={item.test_id}
                  className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  {/* Rank */}
                  <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg", getRankColor(idx))}>
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                  </div>

                  {/* Test info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{item.test_name}</p>
                    <p className="text-xs text-gray-500">
                      {item.subject_name} → {item.topic_name}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-right shrink-0">
                    <div>
                      <p className="text-lg font-bold text-primary-600">{item.best_percentage}%</p>
                      <p className="text-xs text-gray-400">Best</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">{item.average_percentage}%</p>
                      <p className="text-xs text-gray-400">Average</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">{item.attempt_count}</p>
                      <p className="text-xs text-gray-400">Attempts</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
