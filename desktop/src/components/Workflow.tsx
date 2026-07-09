import { createSignal, createEffect, onMount, onCleanup, For, Show } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const STAGES = [
  "选基准分支",
  "拉取 + 构建",
  "讨论 + 实现",
  "写提案",
  "提 PR",
  "Review",
];

// The repo the agent works in.
const CWD = "/Users/juno/projects/autokernel-sz/kerwork";

interface ChatMsg {
  role: "user" | "assistant" | "reasoning" | "action";
  text: string;
}

interface KerminalEvent {
  conversationId: string;
  turnId: string;
  msg: any;
}

export function Workflow(props: { ideaText: string; onBack: () => void }) {
  const [stageIdx, setStageIdx] = createSignal(0);
  const [messages, setMessages] = createSignal<ChatMsg[]>([]);
  const [input, setInput] = createSignal("");
  const [status, setStatus] = createSignal<string>("正在连接 Kerminal...");
  const [convId, setConvId] = createSignal<string | null>(null);
  const [busy, setBusy] = createSignal(false);

  let unlisten: (() => void) | null = null;
  let streamingRole: "assistant" | "reasoning" | null = null;
  let scrollRef: HTMLDivElement | undefined;

  const scrollToBottom = () => {
    if (scrollRef) scrollRef.scrollTop = scrollRef.scrollHeight;
  };

  createEffect(() => {
    messages();
    requestAnimationFrame(scrollToBottom);
  });

  const appendDelta = (role: "assistant" | "reasoning", delta: string) => {
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last && last.role === role && streamingRole === role) {
        copy[copy.length - 1] = { ...last, text: last.text + delta };
      } else {
        copy.push({ role, text: delta });
        streamingRole = role;
      }
      return copy;
    });
  };

  const addAction = (text: string) => {
    streamingRole = null;
    setMessages((prev) => [...prev, { role: "action", text }]);
  };

  onMount(async () => {
    try {
      unlisten = await listen<KerminalEvent>("kerminal-event", (e) => {
        const msg = e.payload.msg;
        const type = msg?.type;
        if (type === "agent_message_content_delta" || type === "agent_message_delta") {
          const delta = msg.delta ?? msg.text ?? msg.content ?? "";
          if (delta) {
            appendDelta("assistant", delta);
            setStatus("回复中...");
          }
        } else if (
          type === "agent_reasoning_raw_content_delta" ||
          type === "agent_reasoning_delta" ||
          type === "reasoning_content_delta" ||
          type === "reasoning_raw_content_delta"
        ) {
          const delta = msg.delta ?? msg.text ?? msg.content ?? "";
          if (delta) {
            appendDelta("reasoning", delta);
            setStatus("思考中...");
          }
        } else if (type === "agent_message") {
          const full = msg.message ?? msg.text ?? "";
          if (full && streamingRole !== "assistant") {
            appendDelta("assistant", full);
          }
        } else if (type === "exec_command_begin") {
          const cmd = Array.isArray(msg.command) ? msg.command.join(" ") : String(msg.command ?? "");
          addAction("🔧 执行命令  " + cmd);
          setStatus("执行命令...");
        } else if (type === "patch_apply_begin") {
          const files = msg.changes ? Object.keys(msg.changes) : [];
          addAction("📝 修改文件  " + (files.length ? files.join(", ") : ""));
          setStatus("修改文件...");
        } else if (type === "web_search_begin") {
          addAction("🔍 联网搜索  " + (msg.query ?? ""));
          setStatus("搜索中...");
        } else if (type === "mcp_tool_call_begin") {
          addAction("🧩 调用工具  " + (msg.server ?? "") + ": " + (msg.tool ?? ""));
          setStatus("调用工具...");
        } else if (type === "task_complete") {
          streamingRole = null;
          setBusy(false);
          setStatus("就绪");
        } else if (type === "task_started") {
          setStatus("思考中...");
        }
      });

      await invoke("kerminal_start");
      setStatus("创建会话...");
      const id = await invoke<string>("kerminal_new_conversation", { cwd: CWD });
      setConvId(id);
      setStatus("就绪");
    } catch (err) {
      setStatus("连接失败：" + String(err));
    }
  });

  onCleanup(() => {
    if (unlisten) unlisten();
  });

  const send = async () => {
    const text = input().trim();
    const id = convId();
    if (!text || !id || busy()) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setBusy(true);
    streamingRole = null;
    setStatus("发送中...");
    try {
      await invoke("kerminal_send_message", { conversationId: id, cwd: CWD, text });
    } catch (err) {
      setStatus("发送失败：" + String(err));
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Left: stage bar */}
      <div
        style={{
          width: "220px",
          "border-right": "1px solid #e8eaed",
          padding: "20px",
          background: "#fafbfc",
          display: "flex",
          "flex-direction": "column",
        }}
      >
        <button
          onClick={props.onBack}
          style={{
            "font-size": "13px",
            color: "#5f6368",
            background: "transparent",
            "text-align": "left",
            "margin-bottom": "20px",
            padding: "0",
          }}
        >
          ← 返回工作台
        </button>

        <div style={{ "font-size": "13px", "font-weight": "600", color: "#202124", "margin-bottom": "6px" }}>
          需求
        </div>
        <div
          style={{
            "font-size": "13px",
            color: "#3c4043",
            background: "#fff",
            border: "1px solid #e8eaed",
            "border-radius": "8px",
            padding: "8px 10px",
            "margin-bottom": "24px",
          }}
        >
          {props.ideaText}
        </div>

        <div style={{ "font-size": "13px", "font-weight": "600", color: "#202124", "margin-bottom": "10px" }}>
          流程进度
        </div>
        <For each={STAGES}>
          {(stage, i) => {
            const done = () => i() < stageIdx();
            const current = () => i() === stageIdx();
            return (
              <button
                onClick={() => setStageIdx(i())}
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "8px",
                  padding: "8px 0",
                  background: "transparent",
                  "text-align": "left",
                  "font-size": "13px",
                  color: current() ? "#1a73e8" : done() ? "#1a7f37" : "#9aa0a6",
                  "font-weight": current() ? "600" : "400",
                }}
              >
                <span>{done() ? "✅" : current() ? "🔵" : "○"}</span>
                <span>{stage}</span>
              </button>
            );
          }}
        </For>
      </div>

      {/* Right: chat */}
      <div style={{ flex: "1", display: "flex", "flex-direction": "column", height: "100vh" }}>
        <div
          style={{
            padding: "12px 20px",
            "border-bottom": "1px solid #e8eaed",
            "font-size": "13px",
            color: "#5f6368",
          }}
        >
          Kerminal · {status()}
        </div>

        <div ref={scrollRef} style={{ flex: "1", "overflow-y": "auto", padding: "20px" }}>
          <Show
            when={messages().length > 0}
            fallback={
              <p style={{ color: "#9aa0a6", "font-size": "14px", "text-align": "center", "margin-top": "40px" }}>
                描述你要实现的功能，开始跟 Kerminal 讨论
              </p>
            }
          >
            <For each={messages()}>
              {(m) => (
                <Show
                  when={m.role !== "reasoning" && m.role !== "action"}
                  fallback={
                    <Show
                      when={m.role === "reasoning"}
                      fallback={
                        <div
                          style={{
                            "margin-bottom": "10px",
                            "font-size": "13px",
                            color: "#5f6368",
                            background: "#f8f9fa",
                            border: "1px solid #eceef1",
                            "border-radius": "8px",
                            padding: "8px 12px",
                            "font-family": "ui-monospace, Menlo, monospace",
                            "white-space": "pre-wrap",
                            "word-break": "break-all",
                          }}
                        >
                          {m.text}
                        </div>
                      }
                    >
                      <div style={{ "margin-bottom": "12px" }}>
                        <div style={{ "font-size": "12px", color: "#9aa0a6", "margin-bottom": "4px" }}>
                          💭 思考过程
                        </div>
                        <div
                          style={{
                            "font-size": "13px",
                            "line-height": "1.6",
                            "white-space": "pre-wrap",
                            color: "#80868b",
                            background: "#fafbfc",
                            border: "1px solid #eceef1",
                            "border-radius": "8px",
                            padding: "10px 12px",
                          }}
                        >
                          {m.text}
                        </div>
                      </div>
                    </Show>
                  }
                >
                  <div
                    style={{
                      "margin-bottom": "16px",
                      display: "flex",
                      "justify-content": m.role === "user" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        "max-width": "80%",
                        padding: "10px 14px",
                        "border-radius": "12px",
                        "font-size": "14px",
                        "line-height": "1.6",
                        "white-space": "pre-wrap",
                        background: m.role === "user" ? "#1a73e8" : "#f1f3f4",
                        color: m.role === "user" ? "#fff" : "#202124",
                      }}
                    >
                      {m.text}
                    </div>
                  </div>
                </Show>
              )}
            </For>
          </Show>
        </div>

        <div style={{ padding: "16px 20px", "border-top": "1px solid #e8eaed", display: "flex", gap: "8px" }}>
          <input
            type="text"
            placeholder="输入消息..."
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            disabled={!convId()}
            style={{
              flex: "1",
              padding: "10px 14px",
              border: "1px solid #e2e4e8",
              "border-radius": "10px",
              "font-size": "14px",
              background: "#fff",
            }}
          />
          <button
            onClick={send}
            disabled={!convId() || busy()}
            style={{
              padding: "10px 20px",
              background: busy() ? "#9aa0a6" : "#111",
              color: "#fff",
              "border-radius": "10px",
              "font-size": "14px",
              "font-weight": "500",
            }}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
