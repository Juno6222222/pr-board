"use client";

import { useState } from "react";
import { PRItem } from "@/lib/types";

interface Props {
  pr: PRItem;
  displayTitle: string;
  onClose: () => void;
}

export function DetailPanel({ pr, displayTitle, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {displayTitle}
            </h2>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <a
                href={pr.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-600 hover:underline"
              >
                PR #{pr.number}
              </a>
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
        <div className="border-t p-4 flex justify-between items-center text-xs text-gray-500">
          <span>
            创建于{" "}
            {new Date(pr.createdAt).toLocaleDateString("zh-CN")}
          </span>
          <span>
            更新于{" "}
            {new Date(pr.updatedAt).toLocaleDateString("zh-CN")}
          </span>
        </div>
      </div>
    </div>
  );
}
