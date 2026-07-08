"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  PRItem,
  Requirement,
  Stage,
  STAGE_CONFIG,
  inferStage,
  getDisplayTitle,
} from "@/lib/types";
import { RequirementCard } from "./RequirementCard";
import { DetailPanel } from "./DetailPanel";

const POLL_INTERVAL = 60_000;

const STAGE_ORDER: Stage[] = [
  "developing",
  "proposal",
  "reviewing",
  "merged",
  "closed",
];

export function Board() {
  const { data: session } = useSession();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPR, setSelectedPR] = useState<Requirement | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/pulls");
      if (!res.ok) {
        if (res.status === 401) return;
        throw new Error("Failed to fetch");
      }
      const prs: PRItem[] = await res.json();
      const reqs = prs.map((pr) => ({
        pr,
        stage: inferStage(pr),
        displayTitle: getDisplayTitle(pr),
      }));
      setRequirements(reqs);
      setError(null);
      setLastUpdated(new Date());
    } catch (e: any) {
      if (requirements.length === 0) {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [session, fetchData]);

  if (!session) return null;

  if (loading && requirements.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        加载中...
      </div>
    );
  }

  if (error && requirements.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        加载失败: {error}
      </div>
    );
  }

  const grouped = STAGE_ORDER.map((stage) => ({
    stage,
    items: requirements.filter((r) => r.stage === stage),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">
          {lastUpdated && `最后更新: ${lastUpdated.toLocaleTimeString("zh-CN")}`}
        </div>
        <button
          onClick={fetchData}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:border-gray-300 transition"
        >
          刷新
        </button>
      </div>

      {grouped.map(({ stage, items }) => {
        const config = STAGE_CONFIG[stage];
        return (
          <div key={stage}>
            <h2 className="text-sm font-medium text-gray-600 mb-3 flex items-center gap-2">
              <span>{config.emoji}</span>
              <span>{config.label}</span>
              <span className="text-gray-400">({items.length})</span>
            </h2>
            <div className="space-y-3">
              {items.map((req) => (
                <RequirementCard
                  key={req.pr.id}
                  pr={req.pr}
                  stage={req.stage}
                  displayTitle={req.displayTitle}
                  onClick={() => setSelectedPR(req)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {requirements.length === 0 && (
        <div className="text-center text-gray-400 py-16">
          暂无需求
        </div>
      )}

      {selectedPR && (
        <DetailPanel
          pr={selectedPR.pr}
          displayTitle={selectedPR.displayTitle}
          onClose={() => setSelectedPR(null)}
        />
      )}
    </div>
  );
}
