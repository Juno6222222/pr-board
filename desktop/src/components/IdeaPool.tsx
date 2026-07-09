import { createSignal, createEffect, For, Show } from "solid-js";

interface Idea {
  id: string;
  content: string;
  status: "draft" | "ready";
  createdAt: number;
}

function load(): Idea[] {
  try {
    const raw = localStorage.getItem("kerflow-ideas");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function IdeaPool(props: { onLaunch?: (text: string) => void }) {
  const [ideas, setIdeas] = createSignal<Idea[]>(load());
  const [input, setInput] = createSignal("");

  createEffect(() => {
    localStorage.setItem("kerflow-ideas", JSON.stringify(ideas()));
  });

  const addIdea = () => {
    const text = input().trim();
    if (!text) return;
    setIdeas([
      { id: Date.now().toString(), content: text, status: "draft", createdAt: Date.now() },
      ...ideas(),
    ]);
    setInput("");
  };

  const remove = (id: string) => setIdeas(ideas().filter((i) => i.id !== id));

  const toggle = (id: string) =>
    setIdeas(
      ideas().map((i) =>
        i.id === id ? { ...i, status: i.status === "draft" ? "ready" : "draft" } : i
      )
    );

  const drafts = () => ideas().filter((i) => i.status === "draft");
  const ready = () => ideas().filter((i) => i.status === "ready");

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", "margin-bottom": "24px" }}>
        <input
          type="text"
          placeholder="💡 记录一个想法，回车添加..."
          value={input()}
          onInput={(e) => setInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addIdea();
          }}
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
          onClick={addIdea}
          style={{
            padding: "10px 20px",
            background: "#111",
            color: "#fff",
            "border-radius": "10px",
            "font-size": "14px",
            "font-weight": "500",
          }}
        >
          添加
        </button>
      </div>

      <Section title="💡 草稿" count={drafts().length}>
        <For each={drafts()}>
          {(idea) => <Card idea={idea} onToggle={toggle} onRemove={remove} />}
        </For>
      </Section>

      <Section title="🚀 待启动" count={ready().length}>
        <For each={ready()}>
          {(idea) => <Card idea={idea} onToggle={toggle} onRemove={remove} onLaunch={props.onLaunch} />}
        </For>
      </Section>

      {ideas().length === 0 && (
        <p style={{ "text-align": "center", color: "#9aa0a6", padding: "48px 0", "font-size": "14px" }}>
          还没有想法，输入一个试试
        </p>
      )}
    </div>
  );
}

function Section(props: { title: string; count: number; children: any }) {
  return (
    <div style={{ "margin-bottom": "24px" }}>
      {props.count > 0 && (
        <h2
          style={{
            "font-size": "13px",
            "font-weight": "600",
            color: "#5f6368",
            "margin-bottom": "10px",
          }}
        >
          {props.title}{" "}
          <span style={{ color: "#9aa0a6", "font-weight": "400" }}>({props.count})</span>
        </h2>
      )}
      <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
        {props.children}
      </div>
    </div>
  );
}

function Card(props: {
  idea: Idea;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onLaunch?: (text: string) => void;
}) {
  const [hover, setHover] = createSignal(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        "align-items": "center",
        gap: "8px",
        padding: "12px 14px",
        background: "#fff",
        border: "1px solid #e8eaed",
        "border-radius": "10px",
        "font-size": "14px",
        "box-shadow": hover() ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
      }}
    >
      <span style={{ flex: "1", color: "#202124" }}>{props.idea.content}</span>
      <Show when={props.idea.status === "ready" && props.onLaunch}>
        <button
          onClick={() => props.onLaunch!(props.idea.content)}
          style={{
            padding: "4px 12px",
            background: "#1a73e8",
            color: "#fff",
            "border-radius": "6px",
            "font-size": "13px",
            "font-weight": "500",
          }}
        >
          启动需求
        </button>
      </Show>
      <div
        style={{
          display: "flex",
          gap: "4px",
          opacity: hover() ? "1" : "0",
          transition: "opacity 0.15s",
        }}
      >
        <button
          onClick={() => props.onToggle(props.idea.id)}
          title={props.idea.status === "draft" ? "标记为待启动" : "退回草稿"}
          style={{ padding: "4px 8px", background: "#f1f3f4", "border-radius": "6px", "font-size": "13px" }}
        >
          {props.idea.status === "draft" ? "🚀" : "💡"}
        </button>
        <button
          onClick={() => props.onRemove(props.idea.id)}
          title="删除"
          style={{ padding: "4px 8px", background: "#f1f3f4", "border-radius": "6px", "font-size": "13px" }}
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
