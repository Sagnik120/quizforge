"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subjectsApi } from "@/lib/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { toast } from "sonner";
import { Plus, Trash2, ChevronRight, ChevronDown, Edit2, FolderOpen } from "lucide-react";
import { Subject, Topic } from "@/types";
import { clsx } from "clsx";

export default function SubjectsPage() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [showTopicFormFor, setShowTopicFormFor] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState("");
  const [subjectColor, setSubjectColor] = useState("#6366f1");
  const [topicName, setTopicName] = useState("");

  const { data: subjects = [] } = useQuery<Subject[]>({
    queryKey: ["subjects"],
    queryFn: () => subjectsApi.list().then(r => r.data),
  });

  const createSubject = useMutation({
    mutationFn: () => subjectsApi.create({ name: subjectName, color: subjectColor }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subjects"] }); setSubjectName(""); setShowSubjectForm(false); toast.success("Subject created"); },
    onError: () => toast.error("Failed to create subject"),
  });

  const deleteSubject = useMutation({
    mutationFn: (id: string) => subjectsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subjects"] }); toast.success("Subject deleted"); },
  });

  const createTopic = useMutation({
    mutationFn: ({ subjectId }: { subjectId: string }) =>
      subjectsApi.createTopic(subjectId, { name: topicName }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subjects"] }); setTopicName(""); setShowTopicFormFor(null); toast.success("Topic created"); },
    onError: () => toast.error("Failed to create topic"),
  });

  const deleteTopic = useMutation({
    mutationFn: ({ subjectId, topicId }: { subjectId: string; topicId: string }) =>
      subjectsApi.deleteTopic(subjectId, topicId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subjects"] }); toast.success("Topic deleted"); },
  });

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subjects & Topics</h1>
            <p className="text-gray-500 mt-1">Organise your study material</p>
          </div>
          <button onClick={() => setShowSubjectForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Subject
          </button>
        </div>

        {/* New subject form */}
        {showSubjectForm && (
          <div className="card mb-4 border-primary-200">
            <h3 className="font-semibold text-gray-800 mb-4">New Subject</h3>
            <div className="flex gap-3">
              <input
                className="input flex-1"
                placeholder="Subject name (e.g. Physics, Mathematics)"
                value={subjectName}
                onChange={e => setSubjectName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && subjectName && createSubject.mutate()}
              />
              <input type="color" value={subjectColor} onChange={e => setSubjectColor(e.target.value)}
                className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer p-1" />
            </div>
            <div className="flex gap-2 mt-3">
              <button className="btn-primary" onClick={() => subjectName && createSubject.mutate()} disabled={!subjectName || createSubject.isPending}>
                {createSubject.isPending ? "Creating..." : "Create"}
              </button>
              <button className="btn-secondary" onClick={() => { setShowSubjectForm(false); setSubjectName(""); }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Subjects list */}
        {subjects.length === 0 ? (
          <div className="card text-center py-12">
            <FolderOpen className="mx-auto mb-3 text-gray-300" size={48} />
            <p className="text-gray-500">No subjects yet. Create your first one above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {subjects.map((subject) => (
              <div key={subject.id} className="card p-0 overflow-hidden">
                {/* Subject header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(expanded === subject.id ? null : subject.id)}
                >
                  <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: subject.color }} />
                  <span className="font-semibold text-gray-800 flex-1">{subject.name}</span>
                  <span className="text-xs text-gray-400">{subject.topics.length} topics</span>
                  <button
                    onClick={e => { e.stopPropagation(); if (confirm("Delete subject and all its topics?")) deleteSubject.mutate(subject.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                  {expanded === subject.id ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                </div>

                {/* Topics */}
                {expanded === subject.id && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-2 bg-gray-50">
                    {subject.topics.map((topic: Topic) => (
                      <div key={topic.id} className="flex items-center gap-2 py-1.5 px-3 bg-white rounded-lg border border-gray-100">
                        <span className="text-sm text-gray-700 flex-1">{topic.name}</span>
                        <button
                          onClick={() => { if (confirm("Delete this topic?")) deleteTopic.mutate({ subjectId: subject.id, topicId: topic.id }); }}
                          className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}

                    {showTopicFormFor === subject.id ? (
                      <div className="flex gap-2 pt-1">
                        <input
                          className="input text-sm flex-1"
                          placeholder="Topic name"
                          value={topicName}
                          onChange={e => setTopicName(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && topicName && createTopic.mutate({ subjectId: subject.id })}
                          autoFocus
                        />
                        <button className="btn-primary text-sm px-3" onClick={() => topicName && createTopic.mutate({ subjectId: subject.id })}>
                          Add
                        </button>
                        <button className="btn-secondary text-sm px-3" onClick={() => { setShowTopicFormFor(null); setTopicName(""); }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowTopicFormFor(subject.id)}
                        className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 py-1 px-3 hover:bg-primary-50 rounded-lg transition-colors"
                      >
                        <Plus size={14} /> Add Topic
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
