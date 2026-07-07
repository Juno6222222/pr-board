"use client";

import { PRItem, STAGE_CONFIG, Stage } from "@/lib/types";

interface Props {
  pr: PRItem;
  stage: Stage;
  displayTitle: string;
  onClick: () => void;
}

export function RequirementCard({ pr, stage, displayTitle, onClick }: Props) {
  const config = STAGE_CONFIG[stage];
  const updatedDate = new Date(pr.updatedAt).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
  });

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-gray-900 text-sm leading-snug">
          {displayTitle}
        </h3>
        <span
          className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${config.color}`}
        >
          {config.emoji} {config.label}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
        <a
          href={pr.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="hover:text-blue-600 hover:underline"
        >
          PR #{pr.number}
        </a>
        <span className="text-gray-300">·</span>
        <span>{pr.branch}</span>
        <span className="text-gray-300">·</span>
        <span>更新于 {updatedDate}</span>
      </div>
      {stage === "reviewing" && pr.reviewComments > 0 && (
        <div className="mt-2 text-xs text-purple-600">
          {pr.reviewComments} 条 review
        </div>
      )}
    </div>
  );
}
