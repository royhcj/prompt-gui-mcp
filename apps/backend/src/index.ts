import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./logger.js";
import {
  handleTellHumanToDo,
  tellHumanToDoInputSchema
} from "./mcp/tell-human-to-do.js";
import { startBackendHttpServer } from "./transport/http.js";

const DEFAULT_SERVER_PORT = 43118;

function resolveServerPort(): number {
  const rawPort =
    process.env.I_AM_MCP_SERVER_PORT ?? process.env.I_AM_MCP_CONTROL_PORT;

  if (!rawPort) {
    return DEFAULT_SERVER_PORT;
  }

  const parsedPort = Number(rawPort);
  const isValidPort = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535;

  if (!isValidPort) {
    throw new Error(`Invalid backend port: ${rawPort}`);
  }

  return parsedPort;
}

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "i-am-mcp-backend",
    version: "0.1.0"
  });

  server.registerTool(
    "tell-human-to-do",
    {
      title: "Tell Human To Do",
      description:
        "Ask a human user to perform a real-world operation and return status + feedback.",
      inputSchema: tellHumanToDoInputSchema.shape
    },
    async (args: { instruction: string }) => {
      const result = await handleTellHumanToDo(args);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result)
          }
        ],
        structuredContent: result
      };
    }
  );

  return server;
}

async function main(): Promise<void> {
  const port = resolveServerPort();
  await startBackendHttpServer({
    port,
    createMcpServer
  });
  logger.info({ port }, "MCP backend server started on HTTP transport");
}

main().catch((error: unknown) => {
  logger.error({ error }, "Fatal server error");
  process.exit(1);
});
