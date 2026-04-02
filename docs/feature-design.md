# i-am-mcp Feature Design

## 1. 目標

`i-am-mcp` 是一個 MCP Server，提供 AI coding agent 一個可呼叫的工具，讓 AI 能請真人協助完成需要人類實際操作的任務。

核心概念：
- 一般 MCP：讓 AI 呼叫程式功能。
- 本專案 MCP：讓 AI 呼叫「人」去做事情。

## 2. 核心工具

### 2.1 工具名稱

- `tell-human-to-do`

### 2.2 用途

當 AI coding agent 在工作流程中遇到必須由人類執行的操作（例如收信、查看手機、輸入 OTP、點擊某網站按鈕），可呼叫 `tell-human-to-do` 發送指令給使用者。

### 2.3 輸入參數（最低需求）

- `instruction`（string, required）  
  要請人執行的指令內容。  
  例如：`請收信並取得驗證碼`

可擴充（非 MVP 必要）：
- `title`（string, optional）
- `timeout_seconds`（number, optional）
- `context`（string, optional）

### 2.4 回傳結果（最低需求）

- `status`（enum: `completed` | `failed`）
- `feedback`（string，可為空）

## 3. UI 規格（MVP）

當 `tell-human-to-do` 被呼叫時，MCP Server 應立即顯示一個小視窗，且視窗需「永遠在最前面」（always on top），即使沒有 focus 也要保持在最上層。

視窗內容：
1. 指令內容（顯示 `instruction`）
2. `完成` 按鈕
3. `失敗` 按鈕
4. 回饋文字框（讓使用者輸入結果）

## 4. 互動流程

1. AI coding agent 呼叫 `tell-human-to-do(instruction: "...")`
2. MCP Server 收到請求後顯示最前面小視窗
3. 使用者執行任務後，在回饋文字框輸入結果
4. 使用者按下：
   - `完成`：代表任務成功
   - `失敗`：代表任務失敗
5. MCP Server 關閉視窗，將 `status + feedback` 回傳給 AI coding agent

## 5. 範例情境

AI coding agent 需要驗證碼，呼叫：

```json
{
  "tool": "tell-human-to-do",
  "arguments": {
    "instruction": "請收信並取得驗證碼"
  }
}
```

使用者看到視窗：

```text
[請收信並取得驗證碼]
[完成] [失敗]
[回饋文字框]
```

### 5.1 成功案例

- 使用者有收到信，在回饋填入：`123456`
- 使用者按下 `完成`
- MCP 回傳：

```json
{
  "status": "completed",
  "feedback": "123456"
}
```

### 5.2 失敗案例

- 使用者未收到信，在回饋填入：`我沒有收到信`
- 使用者按下 `失敗`
- MCP 回傳：

```json
{
  "status": "failed",
  "feedback": "我沒有收到信"
}
```

## 6. MVP 驗收條件

- 可透過 MCP 呼叫 `tell-human-to-do`
- 收到呼叫後會彈出小視窗且維持最前面
- 視窗中正確顯示指令內容
- 使用者可輸入回饋文字
- 使用者可按 `完成` 或 `失敗`
- 按鈕結果與回饋文字可正確回傳給 AI coding agent

## 7. 非功能需求（建議）

- 視窗應簡潔、可快速操作
- 支援鍵盤操作（例如 Enter 送出）
- 若重複呼叫工具，應有可預期行為（排隊或拒絕新任務）
- 記錄基本操作日誌（時間、指令、結果），利於除錯
