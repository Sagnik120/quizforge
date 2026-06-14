"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { testsApi, subjectsApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Plus, Trash2, Play, Clock, BookOpen, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Subject } from "@/types";

export default function TestsPage() {
  const qc = useQueryClient();
  const [filterSubject, setFilterSubject] = useState("");
  const [filterTopic, setFilterTopic] = useState("");

  const { data: subjects = [] } = useQuery<Subject[]>({ queryKey: ["subjects"], queryFn: () => subjectsApi.list().then(r => r.data) });
  const { data: tests = [], isLoading } = useQuery({
    queryKey: ["tests", filterTopic, filterSubject],
    queryFn: () => testsApi.list({ topic_id: filterTopic || undefined, subject_id: filterSubject || undefined }).then(r => r.data),
  });

  const deleteTest = useMutation({
    mutationFn: (id: string) => testsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tests"] }); toast.success("Test deleted"); },
  });

  const selectedSubject = subjects.find((s: Subject) => s.id === filterSubject);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Tests</h1>
            <p className="text-gray-500 mt-1">{tests.length} tests created</p>
          </div>
          <div className="flex gap-2">
            <Link href="/tests/new" className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Create Test
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <select className="input w-48" value={filterSubject} onChange={e => { setFilterSubject(e.target.value); setFilterTopic(""); }}>
            <option value="">All Subjects</option>
            {subjects.map((s: Subject) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {selectedSubject && (
            <select className="input w-48" value={filterTopic} onChange={e => setFilterTopic(e.target.value)}>
              <option value="">All Topics</option>
              {selectedSubject.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </div>

        {isLoading ? (
          <div className="text-gray-400 text-center py-12">Loading...</div>
        ) : tests.length === 0 ? (
          <div className="card text-center py-12">
            <BookOpen className="mx-auto mb-3 text-gray-300" size={48} />
            <p className="text-gray-500 mb-4">No tests yet. Create your first test!</p>
            <Link href="/tests/new" className="btn-primary inline-flex items-center gap-2">
              <Plus size={16} /> Create Test
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tests.map((test: any) => (
              <div key={test.id} className="card hover:border-primary-200 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-800 flex-1 pr-2">{test.name}</h3>
                  <button
                    onClick={() => { if (confirm("Delete this test?")) deleteTest.mutate(test.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {test.description && <p className="text-sm text-gray-500 mb-3 line-clamp-1">{test.description}</p>}
                <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                  <span>{test.total_questions} questions</span>
                  <span>{test.total_marks} marks</span>
                  {test.time_limit_minutes && (
                    <span className="flex items-center gap-1"><Clock size={11} /> {test.time_limit_minutes} min</span>
                  )}
                  <span className="ml-auto">{test.attempt_count} attempts</span>
                </div>
                <Link
                  href={`/attempt?test_id=${test.id}`}
                  className="flex items-center justify-center gap-2 w-full btn-primary text-sm py-2"
                >
                  <Play size={14} /> Attempt Now
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
