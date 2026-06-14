"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CheckCircle, BookMarked, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function AnalyticsPage() {
  const qc = useQueryClient();
  const { data: analytics, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => analyticsApi.summary().then(r => r.data),
  });
  const { data: revision = [] } = useQuery({
    queryKey: ["revision"],
    queryFn: () => analyticsApi.revisionQueue().then(r => r.data),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => analyticsApi.resolveRevision(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revision"] });
      toast.success("Marked as understood!");
    },
  });

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

        {/* Performance chart */}
        {analytics?.recent_performance?.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Last 30 Days Performance</h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={analytics.recent_performance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: any) => `${v}%`} />
                <Line
                  type="monotone"
                  dataKey="percentage"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: "#6366f1", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Weak topics */}
        {analytics?.weak_topics?.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-orange-500" />
              Weak Topics (below 60%)
            </h2>
            <div className="space-y-3">
              {analytics.weak_topics.map((t: any) => (
                <div key={t.topic_name} className="flex items-center gap-4">
                  <span className="text-sm text-gray-700 w-48 truncate">{t.topic_name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                    <div className="bg-orange-400 h-2.5 rounded-full" style={{ width: `${t.avg_score}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-orange-600 w-12 text-right">{t.avg_score}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revision queue */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BookMarked size={18} className="text-primary-600" />
            Revision Queue
            <span className="ml-2 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
              {revision.length} questions
            </span>
          </h2>
          {revision.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">No questions in revision queue. Keep practicing!</p>
          ) : (
            <div className="space-y-3">
              {revision.map((item: any) => (
                <div key={item.id} className="border border-gray-100 rounded-xl p-4 hover:border-primary-200 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 line-clamp-2">{item.question_text}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {item.subject_name}
                        </span>
                        <span className="text-xs text-gray-400">→</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {item.topic_name}
                        </span>
                        <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded">
                          Wrong {item.wrong_count}x
                        </span>
                        <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">
                          {item.question_type}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => resolveMutation.mutate(item.id)}
                      disabled={resolveMutation.isPending}
                      className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                    >
                      <CheckCircle size={14} />
                      Got it
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
