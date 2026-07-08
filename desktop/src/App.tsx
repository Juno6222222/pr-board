import { IdeaPool } from "./components/IdeaPool";
import { Board } from "./components/Board";

function App() {
  return (
    <div style={{ "max-width": "720px", margin: "0 auto", padding: "40px 20px" }}>
      <header style={{ "margin-bottom": "32px" }}>
        <h1 style={{ "font-size": "22px", "font-weight": "700", color: "#111", margin: "0" }}>
          KerFlow
        </h1>
        <p style={{ "font-size": "14px", color: "#5f6368", margin: "6px 0 0" }}>
          从想法到 PR，一个 App 搞定
        </p>
      </header>

      <IdeaPool />

      <div style={{ height: "1px", background: "#e8eaed", margin: "32px 0" }}></div>

      <h2 style={{ "font-size": "16px", "font-weight": "700", color: "#111", margin: "0 0 4px" }}>
        需求看板
      </h2>
      <p style={{ "font-size": "13px", color: "#9aa0a6", margin: "0 0 16px" }}>
        自动同步 GitHub 需求进展
      </p>
      <Board />
    </div>
  );
}

export default App;
