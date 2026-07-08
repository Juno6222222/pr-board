"use client";

import { PRItem } from "@/lib/types";

interface Props {
  pr: PRItem;
  displayTitle: string;
  onClose: () => void;
}

export function DetailPanel({ pr, displayTitle, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {displayTitle}
            </h2>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <span>PR #{pr.number}</span>
              <span>·</span>
              <span>{pr.branch}</span>
              <span>·</span>
              <span>{pr.author}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {pr.body ? (
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              {pr.body}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">暂无描述</p>
          )}
        </div>
        <div className="border-t p-4 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            <span>创建于 {new Date(pr.createdAt).toLocaleDateString("zh-CN")}</span>
            <span className="mx-2">·</span>
            <span>更新于 {new Date(pr.updatedAt).toLocaleDateString("zh-CN")}</span>
          </div>
          <a
            href={pr.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-700 transition"
          >
            在 GitHub 上查看 ↗
          </a>
        </div>
      </div>
    </div>
  );
}
