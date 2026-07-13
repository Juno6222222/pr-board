import { createSignal, Show, For } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

const CWD = "/Users/juno/projects/autokernel-sz/kerwork";

interface BranchInfo {
  current: string;
  branches: string[];
}
interface GitStatus {
  currentBranch: string;
  changedFiles: string[];
}

type PanelKey = "branch" | "commit" | "pr" | "revise" | null;

const cardStyle = {
  background: "#fff",
  border: "1px solid #e8eaed",
  "border-radius": "8px",
  padding: "10px",
  "margin-bottom": "8px",
};

const btnStyle = (color: string) => ({
  padding: "8px 0",
  width: "100%",
  background: color,
  color: "#fff",
  "border-radius": "6px",
  "font-size": "13px",
  "font-weight": "500",
  "margin-top": "8px",
});

const inputStyle = {
  width: "100%",
  padding: "6px 8px",
  border: "1px solid #e2e4e8",
  "border-radius": "6px",
  "font-size": "13px",
  "box-sizing": "border-box" as const,
  "margin-top": "4px",
};

const labelStyle = { "font-size": "12px", color: "#5f6368", "margin-top": "8px" };

export function GitOps(props: { onStage?: (idx: number) => void }) {
  const [open, setOpen] = createSignal<PanelKey>(null);
  const [msg, setMsg] = createSignal<string>("");

  // branch panel
  const [branchInfo, setBranchInfo] = createSignal<BranchInfo | null>(null);
  const [base, setBase] = createSignal("dev");
  const [newBranch, setNewBranch] = createSignal("proposal/");

  // commit panel
  const [status, setStatus] = createSignal<GitStatus | null>(null);
  const [commitMsg, setCommitMsg] = createSignal("");

  // pr panel
  const [prTitle, setPrTitle] = createSignal("");
  const [prBody, setPrBody] = createSignal("");
  const [prBase, setPrBase] = createSignal("dev");

  const [prUrl, setPrUrl] = createSignal<string | null>(null);

  // revise panel (二次提交追加 body)
  const [reviseNote, setReviseNote] = createSignal("");

  const toggle = async (key: PanelKey) => {
    setMsg("");
    if (open() === key) {
      setOpen(null);
      return;
    }
    setOpen(key);
    if (key === "branch") {
      try {
        const info = await invoke<BranchInfo>("git_branch_info", { cwd: CWD });
        setBranchInfo(info);
        setBase(info.branches.includes("dev") ? "dev" : info.current);
      } catch (e) {
        setMsg("读取分支失败：" + String(e));
      }
    } else if (key === "commit") {
      try {
        const st = await invoke<GitStatus>("git_status", { cwd: CWD });
        setStatus(st);
      } catch (e) {
        setMsg("读取改动失败：" + String(e));
      }
    }
  };

  const doBranch = async () => {
    const name = newBranch().trim();
    if (!name || name === "proposal/") {
      setMsg("请填写新分支名");
      return;
    }
    if (!name.startsWith("proposal/")) {
      setMsg("分支名需以 proposal/ 开头");
      return;
    }
    try {
      const r = await invoke<string>("git_create_branch", {
        cwd: CWD,
        base: base(),
        newBranch: name,
      });
      setMsg("✅ " + r);
      props.onStage?.(2);
    } catch (e) {
      setMsg("❌ " + String(e));
    }
  };

  const doCommit = async () => {
    if (!commitMsg().trim()) {
      setMsg("请填写提交信息");
      return;
    }
    try {
      const r = await invoke<string>("git_commit_push", {
        cwd: CWD,
        message: commitMsg().trim(),
      });
      setMsg("✅ " + r);
      props.onStage?.(4);
    } catch (e) {
      setMsg("❌ " + String(e));
    }
  };

  const doPr = async () => {
    if (!prTitle().trim()) {
      setMsg("请填写 PR 标题");
      return;
    }
    try {
      const st = await invoke<GitStatus>("git_status", { cwd: CWD });
      const head = st.currentBranch;
      const url = await invoke<string>("create_pull_request", {
        title: prTitle().trim(),
        body: prBody(),
        head,
        base: prBase(),
      });
      setPrUrl(url);
      setMsg("✅ PR 已创建");
      props.onStage?.(5);
    } catch (e) {
      setMsg("❌ " + String(e));
    }
  };

  const doRevise = async () => {
    if (!reviseNote().trim()) {
      setMsg("请填写本轮修复说明");
      return;
    }
    try {
      const st = await invoke<GitStatus>("git_status", { cwd: CWD });
      const head = st.currentBranch;
      const date = new Date().toISOString().slice(0, 10);
      const note = `## 修订记录（${date}）\n${reviseNote().trim()}`;
      const url = await invoke<string>("append_pr_body", { head, note });
      setPrUrl(url);
      setReviseNote("");
      setMsg("✅ 已追加到 PR 描述");
      props.onStage?.(5);
    } catch (e) {
      setMsg("❌ " + String(e));
    }
  };

  const tab = (key: PanelKey, label: string) => (
    <button
      onClick={() => toggle(key)}
      style={{
        padding: "8px 0",
        width: "100%",
        background: open() === key ? "#e8f0fe" : "#f1f3f4",
        color: open() === key ? "#1a73e8" : "#3c4043",
        "border-radius": "6px",
        "font-size": "13px",
        "font-weight": "500",
        "margin-bottom": "6px",
        "text-align": "left",
        "padding-left": "10px",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ "margin-top": "20px" }}>
      <div style={{ "font-size": "13px", "font-weight": "600", color: "#202124", "margin-bottom": "10px" }}>
        操作
      </div>

      {tab("branch", "🌿 拉分支")}
      <Show when={open() === "branch"}>
        <div style={cardStyle}>
          <div style={labelStyle}>基准分支</div>
          <select
            value={base()}
            onChange={(e) => setBase(e.currentTarget.value)}
            style={inputStyle}
          >
            <For each={branchInfo()?.branches ?? []}>
              {(b) => <option value={b}>{b}</option>}
            </For>
          </select>
          <div style={labelStyle}>新分支名</div>
          <input
            type="text"
            placeholder="feat/xxx"
            value={newBranch()}
            onInput={(e) => setNewBranch(e.currentTarget.value)}
            style={inputStyle}
          />
          <button onClick={doBranch} style={btnStyle("#1a73e8")}>
            确认拉分支
          </button>
        </div>
      </Show>

      {tab("commit", "📤 提交推送")}
      <Show when={open() === "commit"}>
        <div style={cardStyle}>
          <div style={labelStyle}>
            当前分支：{status()?.currentBranch ?? "..."}
          </div>
          <div style={labelStyle}>
            改动文件（{status()?.changedFiles.length ?? 0}）
          </div>
          <div
            style={{
              "max-height": "120px",
              "overflow-y": "auto",
              "font-size": "12px",
              color: "#5f6368",
              background: "#f8f9fa",
              "border-radius": "6px",
              padding: "6px 8px",
              "margin-top": "4px",
            }}
          >
            <Show when={(status()?.changedFiles.length ?? 0) > 0} fallback={<span>无改动</span>}>
              <For each={status()?.changedFiles ?? []}>
                {(f) => <div style={{ "word-break": "break-all" }}>{f}</div>}
              </For>
            </Show>
          </div>
          <div style={labelStyle}>提交信息</div>
          <input
            type="text"
            placeholder="docs(proposal): xxx"
            value={commitMsg()}
            onInput={(e) => setCommitMsg(e.currentTarget.value)}
            style={inputStyle}
          />
          <button onClick={doCommit} style={btnStyle("#1a7f37")}>
            确认提交并推送
          </button>
        </div>
      </Show>

      {tab("pr", "🔀 创建 PR")}
      <Show when={open() === "pr"}>
        <div style={cardStyle}>
          <div style={labelStyle}>标题</div>
          <input
            type="text"
            placeholder="docs(proposal): xxx"
            value={prTitle()}
            onInput={(e) => setPrTitle(e.currentTarget.value)}
            style={inputStyle}
          />
          <div style={labelStyle}>目标分支（base）</div>
          <input
            type="text"
            value={prBase()}
            onInput={(e) => setPrBase(e.currentTarget.value)}
            style={inputStyle}
          />
          <div style={labelStyle}>描述</div>
          <textarea
            placeholder="可选"
            value={prBody()}
            onInput={(e) => setPrBody(e.currentTarget.value)}
            style={{ ...inputStyle, "min-height": "60px", resize: "vertical" }}
          />
          <button onClick={doPr} style={btnStyle("#6b3fa0")}>
            确认创建 PR
          </button>
          <Show when={prUrl()}>
            <button
              onClick={() => openUrl(prUrl()!)}
              style={{ ...btnStyle("#111"), "margin-top": "6px" }}
            >
              打开 PR ↗
            </button>
          </Show>
        </div>
      </Show>

      {tab("revise", "♻️ 二次提交")}
      <Show when={open() === "revise"}>
        <div style={cardStyle}>
          <div style={{ "font-size": "12px", color: "#5f6368", "line-height": "1.5" }}>
            被打回后：先用「提交推送」提交代码和 md，再在这里追加本轮修复说明到 PR 描述（原标题和原内容不变）。
          </div>
          <div style={labelStyle}>本轮修复了什么</div>
          <textarea
            placeholder="- 针对 review 指出的 XXX 问题：说明如何修复"
            value={reviseNote()}
            onInput={(e) => setReviseNote(e.currentTarget.value)}
            style={{ ...inputStyle, "min-height": "70px", resize: "vertical" }}
          />
          <button onClick={doRevise} style={btnStyle("#c5641e")}>
            确认追加到 PR 描述
          </button>
          <Show when={prUrl()}>
            <button
              onClick={() => openUrl(prUrl()!)}
              style={{ ...btnStyle("#111"), "margin-top": "6px" }}
            >
              打开 PR ↗
            </button>
          </Show>
        </div>
      </Show>

      <Show when={msg()}>
        <div
          style={{
            "font-size": "12px",
            "margin-top": "8px",
            color: msg().startsWith("❌") ? "#d93025" : "#1a7f37",
            "word-break": "break-all",
          }}
        >
          {msg()}
        </div>
      </Show>
    </div>
  );
}
