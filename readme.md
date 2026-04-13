# i-am-mcp

Monorepo for the backend MCP server and the Tauri desktop app that launches it as a sidecar.

## Dev

Use these commands during local development:

- `pnpm --filter backend check`
- `pnpm --filter backend build`
- `pnpm --filter backend simulate`
- `pnpm --filter desktop check`
- `pnpm --filter desktop tauri:dev`

Useful supporting commands:

- `pnpm --filter backend dev`
- `pnpm --filter desktop dev`

`pnpm --filter desktop tauri:dev` starts the desktop app and launches the backend sidecar automatically on localhost.

## Production

Use these commands for production builds:

- `pnpm --filter backend build`
- `pnpm --filter desktop build`
- `pnpm --filter desktop tauri:build`

Notes:

- The backend runs over HTTP on `127.0.0.1:43118` by default.
- The desktop app expects the backend to be launched by Tauri as a sidecar.
- MCP tool calling uses the HTTP endpoint rather than stdio.
