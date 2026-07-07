export interface PRItem {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  merged: boolean;
  branch: string;
  author: string;
  updatedAt: string;
  createdAt: string;
  reviewComments: number;
  htmlUrl: string;
  body: string | null;
}

export type Stage =
  | "developing"
  | "proposal"
  | "reviewing"
  | "merged"
  | "closed";

export interface Requirement {
  pr: PRItem;
  stage: Stage;
  displayTitle: string;
}

export function inferStage(pr: PRItem): Stage {
  if (pr.state === "closed" && pr.merged) return "merged";
  if (pr.state === "closed" && !pr.merged) return "closed";
  if (pr.state === "open" && pr.reviewComments > 0) return "reviewing";
  return "proposal";
}

export function getDisplayTitle(pr: PRItem): string {
  return pr.title
    .replace(/^docs\(proposal\):\s*/i, "")
    .replace(/^feat\(.*?\):\s*/i, "")
    .replace(/^fix\(.*?\):\s*/i, "")
    .trim();
}

export const STAGE_CONFIG: Record<
  Stage,
  { label: string; color: string; emoji: string }
> = {
  developing: { label: "开发中", color: "bg-blue-100 text-blue-800", emoji: "🔨" },
  proposal: { label: "提案中", color: "bg-yellow-100 text-yellow-800", emoji: "📝" },
  reviewing: { label: "Review 中", color: "bg-purple-100 text-purple-800", emoji: "👀" },
  merged: { label: "已合入", color: "bg-green-100 text-green-800", emoji: "✅" },
  closed: { label: "已关闭", color: "bg-gray-100 text-gray-800", emoji: "🚫" },
};
