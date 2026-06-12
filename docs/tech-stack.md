# prompt-gui-mcp Tech Stack

## 1. 結論

你的提案方向是對的，建議採用：

- Backend: Node.js + TypeScript + pnpm
- Frontend: Svelte + Vite + TypeScript
- Desktop shell: Tauri v2（Rust）

這組合很適合 MVP，特別是你需要「always on top 小視窗 + 本機工具整合 + 輕量發佈」。

## 2. 具體建議

### 2.1 Backend（MCP Server）

- Runtime: Node.js 22 LTS
- Language: TypeScript
- Package manager: pnpm
- 形式: 獨立 `backend` 服務，由 Tauri 啟動與管理（sidecar process）

建議原因：
- MCP 生態與 JS/TS 工具鏈相容性高
- pnpm workspace 管理多 package 很方便
- 把 backend 獨立成 sidecar，未來可單獨測試/替換

### 2.2 Frontend（操作視窗）

- Framework: Svelte（若後續需要 routing 再評估 SvelteKit）
- Build tool: Vite
- UI: 先以簡單原生 CSS 為主（MVP 不引入大型 UI framework）

建議原因：
- Svelte 體積小、響應快，做小視窗互動很合適
- Vite 開發體驗佳，搭配 Tauri dev flow 成熟

### 2.3 Desktop App（封裝與系統能力）

- Tauri v2
- 功能：
  - 視窗 `alwaysOnTop`
  - 啟動/停止 Node sidecar
  - 前端與後端橋接（Tauri command / 本機 HTTP / WebSocket）

建議原因：
- 安裝包比 Electron 輕很多
- 原生視窗控制能力符合需求
- 安全模型清楚，可限制 IPC 能力範圍

## 3. 關鍵架構決策

### 3.1 「Tauri app should include frontend and backend server」實作方式

採用：

- 前端：打包成靜態資產，內嵌在 Tauri app
- 後端：Node MCP server 以 sidecar 一起打包並隨 app 啟動

不建議：

- 把 MCP 邏輯硬塞進 Rust 主程序（會降低 JS MCP 生態兼容性）
- 讓前端直接對外網路服務埠（MVP 複雜度提升）

### 3.2 前後端通訊

MVP 建議優先順序：

1. Tauri command（前端 <-> Rust）+ Rust 轉發至 Node sidecar（最安全）
2. 若需要 streaming，再加本機 loopback WebSocket

### 3.3 任務佇列策略（對應 feature doc 的非功能需求）

- MVP 先採「單一進行中任務 + 新任務排隊」
- 在 backend 維護 queue 與 task state（`pending` / `active` / `completed` / `failed`）

## 4. 開發工具與品質

- Monorepo: pnpm workspace
- Lint/format: ESLint + Prettier
- Testing:
  - backend: Vitest
  - frontend: Vitest + Testing Library（後續可加）
  - e2e: Playwright（後續）
- Logging:
  - backend 結構化 log（pino）
  - tauri/rust log 用於 sidecar 啟停與錯誤追蹤

## 5. 風險與對策

- 風險：Node sidecar 在不同 OS 的打包路徑與啟動參數差異
  - 對策：早期就建立 macOS + Windows 最小打包驗證流程
- 風險：always-on-top 行為在多螢幕/全螢幕 app 下有差異
  - 對策：建立視窗行為測試清單（focus、失焦、最小化後恢復）
- 風險：MCP 請求與 UI 回應的同步一致性
  - 對策：以 task id 關聯請求與回覆，避免 race condition

