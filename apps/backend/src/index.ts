import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logger } from "./logger.js";
import {
  handleTellHumanToDo,
  tellHumanToDoInputSchema
} from "./mcp/tell-human-to-do.js";
import { startControlServer } from "./transport/http.js";

async function main(): Promise<void> {
  await startControlServer();

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

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP backend server started on stdio transport");
}

main().catch((error: unknown) => {
  logger.error({ error }, "Fatal server error");
  process.exit(1);
});
