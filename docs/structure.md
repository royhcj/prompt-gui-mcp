# i-am-mcp Project Structure

## 1. 建議目錄

```text
i-am-mcp/
├─ docs/
│  ├─ feature-design.md
│  ├─ tech-stack.md
│  └─ structure.md
├─ apps/
│  ├─ desktop/                    # Tauri app (Rust + embedded frontend)
│  │  ├─ src-tauri/
│  │  │  ├─ src/
│  │  │  │  ├─ main.rs
│  │  │  │  ├─ commands.rs        # Tauri commands
│  │  │  │  └─ sidecar.rs         # 啟停 Node backend
│  │  │  ├─ tauri.conf.json
│  │  │  └─ Cargo.toml
│  │  ├─ src/                     # Svelte frontend source
│  │  │  ├─ App.svelte
│  │  │  ├─ main.ts
│  │  │  ├─ lib/
│  │  │  │  ├─ api.ts             # 呼叫 Tauri command
│  │  │  │  └─ types.ts
│  │  │  └─ styles/
│  │  ├─ index.html
│  │  ├─ package.json
│  │  ├─ tsconfig.json
│  │  └─ vite.config.ts
│  └─ backend/                    # Node.js MCP server (sidecar)
│     ├─ src/
│     │  ├─ index.ts              # server entry
│     │  ├─ mcp/
│     │  │  └─ tell-human-to-do.ts
│     │  ├─ services/
│     │  │  ├─ task-queue.ts
│     │  │  └─ task-store.ts
│     │  ├─ transport/
│     │  │  ├─ http.ts
│     │  │  └─ events.ts
│     │  └─ types.ts
│     ├─ package.json
│     ├─ tsconfig.json
│     └─ vitest.config.ts
├─ packages/
│  └─ shared/                     # frontend/backend 共用型別與 schema
│     ├─ src/
│     │  ├─ task.ts
│     │  └─ tool.ts
│     ├─ package.json
│     └─ tsconfig.json
├─ pnpm-workspace.yaml
├─ package.json
├─ tsconfig.base.json
├─ .editorconfig
├─ .gitignore
└─ README.md
```

## 2. 模組責任

- `apps/backend`: MCP tool 實作、任務狀態管理、回傳 `status + feedback`
- `apps/desktop/src-tauri`: 視窗控制（always on top）、sidecar lifecycle、桌面權限邊界
- `apps/desktop/src`: 使用者互動 UI（顯示 instruction / 填 feedback / 完成或失敗）
- `packages/shared`: 共用型別、資料契約、驗證 schema

## 3. 通訊流

1. AI agent 呼叫 MCP tool 到 `apps/backend`
2. backend 發送事件給 desktop app（顯示任務）
3. 使用者在 frontend 操作完成/失敗 + feedback
4. desktop app 傳回 backend
5. backend 回覆 MCP 呼叫結果

## 4. 命名與實作慣例

- 一律 TypeScript strict mode
- 型別先行：先定義 `packages/shared` 契約，再實作前後端
- 工具名稱與 feature doc 一致：`tell-human-to-do`
- UI 文案與回傳欄位名稱和設計文件保持一致，避免語意漂移

## 5. MVP 優先順序

1. 打通「MCP 呼叫 -> UI 彈窗 -> 使用者提交 -> MCP 回傳」
2. 完成 always-on-top 與基本 keyboard 操作
3. 加入 task queue 與基礎 log
4. 補測試與跨平台打包驗證

