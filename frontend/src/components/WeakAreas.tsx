"use client";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import { Loader, ProgressBar, SpaceBadge, pctColor } from "@/components/ui";

function Row({ node, depth }: { node: any; depth: number }) {
  const tried = node.percentage !== null;
  return (
    <div className="flex items-center gap-3 py-1.5" style={{ paddingLeft: depth * 20 }}>
      <span className={depth === 0 ? "w-48 truncate font-semibold text-gray-800" : "w-48 truncate text-sm text-gray-600"}>
        {node.name}
      </span>
      {depth === 0 && <SpaceBadge space={node.space} />}
      <div className="flex-1">{tried ? <ProgressBar value={node.percentage} /> : <div className="h-2 rounded-full bg-gray-50" />}</div>
      <span className="w-28 text-right text-sm font-medium" style={{ color: tried ? pctColor(node.percentage) : "#9ca3af" }}>
        {tried ? `${node.percentage}%${node.percentage < 60 ? " · weak" : ""}` : "not attempted"}
      </span>
    </div>
  );
}

// Weakest first; things never attempted sink to the bottom
const byWeakness = (a: any, b: any) => (a.percentage ?? 101) - (b.percentage ?? 101);

export function WeakAreas() {
  const { data = [], isLoading } = useQuery<any[]>({
    queryKey: ["weak-areas"],
    queryFn: () => analyticsApi.weakAreas().then((r) => r.data),
  });
  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-800">Strength by subject, topic and sub-topic</h2>
      <p className="text-sm text-gray-500 mb-4">Marks you earned out of marks possible, across all your attempts. Under 60% is weak.</p>
      {isLoading ? <Loader /> : data.length === 0 ? (
        <p className="text-sm text-gray-400">Add subjects and attempt a few tests to see this fill in.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {[...data].sort(byWeakness).map((s) => (
            <div key={s.id} className="py-2">
              <Row node={s} depth={0} />
              {[...s.topics].sort(byWeakness).map((t: any) => (
                <div key={t.id}>
                  <Row node={t} depth={1} />
                  {[...t.subtopics].sort(byWeakness).map((st: any) => <Row key={st.id} node={st} depth={2} />)}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
