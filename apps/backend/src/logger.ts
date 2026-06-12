import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "prompt-gui-mcp-backend" }
}, pino.destination(2));
