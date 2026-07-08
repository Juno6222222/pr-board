import { createSignal, createEffect, onCleanup, For, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

interface PR {
  number: number;
  title: string;
  state: string;
  merged: boolean;
  branch: string;
  author: string;
  updated_at: string;
  created_at: string;
  review_comments: number;
  html_url: string;
  body: string | null;
}

type Stage = "proposal" | "reviewing" | "merged" | "closed";

const STAGE_META: Record<Stage, { label: string; emoji: string; color: string; bg: string }> = {
  proposal: { label: "提案中", emoji: "📝", color: "#8a6d00", bg: "#fef7dc" },
  reviewing: { label: "Review 中", emoji: "👀", color: "#6b3fa0", bg: "#f3ebfc" },
  merged: { label: "已合入", emoji: "✅", color: "#1a7f37", bg: "#e6f4ea" },
  closed: { label: "已关闭", emoji: "🚫", color: "#5f6368", bg: "#f1f3f4" },
};

const STAGE_ORDER: Stage[] = ["reviewing", "proposal", "merged", "closed"];

function inferStage(pr: PR): Stage {
  if (pr.state === "closed" && pr.merged) return "merged";
  if (pr.state === "closed") return "closed";
  if (pr.review_comments > 0) return "reviewing";
  return "proposal";
}

function cleanTitle(title: string): string {
  return title.replace(/^docs\(proposal\):\s*/i, "").replace(/^\w+\(.*?\):\s*/, "").trim();
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Board() {
  const [prs, setPrs] = createSignal<PR[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [selected, setSelected] = createSignal<PR | null>(null);
  const [lastUpdated, setLastUpdated] = createSignal<Date | null>(null);

  const fetchData = async () => {
    try {
      const data = await invoke<PR[]>("fetch_pull_requests");
      setPrs(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (e) {
      if (prs().length === 0) setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  fetchData();
  const timer = setInterval(fetchData, 60_000);
  onCleanup(() => clearInterval(timer));

  const grouped = () =>
    STAGE_ORDER.map((stage) => ({
      stage,
      items: prs().filter((p) => inferStage(p) === stage),
    })).filter((g) => g.items.length > 0);

  return (
    <div style={{ "margin-top": "8px" }}>
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          "margin-bottom": "16px",
        }}
      >
        <span style={{ "font-size": "12px", color: "#9aa0a6" }}>
          {lastUpdated() ? `最后更新：${fmtDate(lastUpdated()!.toISOString())}` : ""}
        </span>
        <button
          onClick={fetchData}
          style={{
            "font-size": "12px",
            color: "#5f6368",
            padding: "4px 10px",
            border: "1px solid #e2e4e8",
            "border-radius": "6px",
            background: "#fff",
          }}
        >
          刷新
        </button>
      </div>

      <Show when={loading() && prs().length === 0}>
        <p style={{ "text-align": "center", color: "#9aa0a6", padding: "32px 0", "font-size": "14px" }}>
          加载中...
        </p>
      </Show>

      <Show when={error() && prs().length === 0}>
        <p style={{ "text-align": "center", color: "#d93025", padding: "32px 0", "font-size": "14px" }}>
          加载失败：{error()}
        </p>
      </Show>

      <For each={grouped()}>
        {(group) => {
          const meta = STAGE_META[group.stage];
          return (
            <div style={{ "margin-bottom": "20px" }}>
              <h2
                style={{
                  "font-size": "13px",
                  "font-weight": "600",
                  color: "#5f6368",
                  "margin-bottom": "10px",
                }}
              >
                {meta.emoji} {meta.label}{" "}
                <span style={{ color: "#9aa0a6", "font-weight": "400" }}>({group.items.length})</span>
              </h2>
              <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
                <For each={group.items}>
                  {(pr) => <PRCard pr={pr} onClick={() => setSelected(pr)} />}
                </For>
              </div>
            </div>
          );
        }}
      </For>

      <Show when={selected()}>
        <DetailPanel pr={selected()!} onClose={() => setSelected(null)} />
      </Show>
    </div>
  );
}

function PRCard(props: { pr: PR; onClick: () => void }) {
  const [hover, setHover] = createSignal(false);
  const stage = () => inferStage(props.pr);
  const meta = () => STAGE_META[stage()];
  return (
    <div
      onClick={props.onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "#fff",
        border: "1px solid #e8eaed",
        "border-radius": "10px",
        padding: "14px",
        cursor: "pointer",
        "box-shadow": hover() ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
        transition: "box-shadow 0.15s",
      }}
    >
      <div style={{ display: "flex", "align-items": "flex-start", "justify-content": "space-between", gap: "8px" }}>
        <span style={{ "font-size": "14px", "font-weight": "500", color: "#202124" }}>
          {cleanTitle(props.pr.title)}
        </span>
        <span
          style={{
            "font-size": "12px",
            padding: "2px 8px",
            "border-radius": "10px",
            color: meta().color,
            background: meta().bg,
            "white-space": "nowrap",
          }}
        >
          {meta().emoji} {meta().label}
        </span>
      </div>
      <div style={{ "margin-top": "8px", "font-size": "12px", color: "#9aa0a6", display: "flex", gap: "8px" }}>
        <span>PR #{props.pr.number}</span>
        <span>·</span>
        <span>{props.pr.branch}</span>
        <span>·</span>
        <span>{fmtDate(props.pr.updated_at)}</span>
      </div>
    </div>
  );
}

function DetailPanel(props: { pr: PR; onClose: () => void }) {
  return (
    <div
      onClick={props.onClose}
      style={{
        position: "fixed",
        inset: "0",
        background: "rgba(0,0,0,0.3)",
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        padding: "16px",
        "z-index": "50",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          "border-radius": "12px",
          "max-width": "640px",
          width: "100%",
          "max-height": "80vh",
          display: "flex",
          "flex-direction": "column",
          overflow: "hidden",
          "box-shadow": "0 10px 40px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ padding: "20px", "border-bottom": "1px solid #e8eaed", display: "flex", "justify-content": "space-between", "align-items": "flex-start" }}>
          <div>
            <h2 style={{ "font-size": "17px", "font-weight": "600", margin: "0", color: "#202124" }}>
              {cleanTitle(props.pr.title)}
            </h2>
            <div style={{ "margin-top": "6px", "font-size": "13px", color: "#5f6368", display: "flex", gap: "8px" }}>
              <span>PR #{props.pr.number}</span>
              <span>·</span>
              <span>{props.pr.branch}</span>
              <span>·</span>
              <span>{props.pr.author}</span>
            </div>
          </div>
          <button onClick={props.onClose} style={{ background: "transparent", "font-size": "20px", color: "#9aa0a6", "line-height": "1" }}>
            ✕
          </button>
        </div>
        <div style={{ flex: "1", "overflow-y": "auto", padding: "20px" }}>
          <Show when={props.pr.body} fallback={<p style={{ color: "#9aa0a6", "font-size": "14px" }}>暂无描述</p>}>
            <pre style={{ "white-space": "pre-wrap", "font-family": "inherit", "font-size": "14px", color: "#3c4043", margin: "0" }}>
              {props.pr.body}
            </pre>
          </Show>
        </div>
        <div style={{ "border-top": "1px solid #e8eaed", padding: "16px 20px", display: "flex", "justify-content": "space-between", "align-items": "center" }}>
          <span style={{ "font-size": "12px", color: "#9aa0a6" }}>
            创建于 {fmtDate(props.pr.created_at)}
          </span>
          <button
            onClick={() => openUrl(props.pr.html_url)}
            style={{ padding: "8px 16px", background: "#111", color: "#fff", "border-radius": "8px", "font-size": "14px", "font-weight": "500" }}
          >
            在 GitHub 上查看 ↗
          </button>
        </div>
      </div>
    </div>
  );
}
