import { createSignal } from "solid-js";
import { IdeaPool } from "./components/IdeaPool";
import { Board } from "./components/Board";

type Tab = "ideas" | "board";

function App() {
  const [tab, setTab] = createSignal<Tab>("ideas");

  const tabStyle = (active: boolean) => ({
    padding: "8px 16px",
    "font-size": "14px",
    "font-weight": active ? "600" : "400",
    color: active ? "#111" : "#5f6368",
    background: active ? "#fff" : "transparent",
    border: active ? "1px solid #e2e4e8" : "1px solid transparent",
    "border-radius": "8px",
    cursor: "pointer",
  });

  return (
    <div style={{ "max-width": "720px", margin: "0 auto", padding: "40px 20px" }}>
      <header style={{ "margin-bottom": "24px" }}>
        <h1 style={{ "font-size": "22px", "font-weight": "700", color: "#111", margin: "0" }}>
          KerFlow
        </h1>
        <p style={{ "font-size": "14px", color: "#5f6368", margin: "6px 0 0" }}>
          从想法到 PR，一个 App 搞定
        </p>
      </header>

      <div style={{ display: "flex", gap: "8px", "margin-bottom": "24px" }}>
        <button style={tabStyle(tab() === "ideas")} onClick={() => setTab("ideas")}>
          💡 想法池
        </button>
        <button style={tabStyle(tab() === "board")} onClick={() => setTab("board")}>
          📋 需求看板
        </button>
      </div>

      <div style={{ display: tab() === "ideas" ? "block" : "none" }}>
        <IdeaPool />
      </div>
      <div style={{ display: tab() === "board" ? "block" : "none" }}>
        <Board />
      </div>
    </div>
  );
}

export default App;
