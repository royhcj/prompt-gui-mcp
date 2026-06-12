import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./logger.js";
import {
  handlePromptForm,
  promptFormInputSchema,
  type PromptFormInput
} from "./mcp/prompt-form.js";
import {
  handleTellHumanToDo,
  tellHumanToDoInputSchema
} from "./mcp/tell-human-to-do.js";
import {
  handleWaitForPrompt,
  waitForPromptInputSchema,
  type WaitForPromptInput
} from "./mcp/wait-for-prompt.js";
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
    name: "prompt-gui-mcp-backend",
    version: "0.1.0"
  });

  // server.registerTool(
  //   "tell-human-to-do",
  //   {
  //     title: "Tell Human To Do",
  //     description:
  //       "Ask a human user to perform a real-world operation and return status + feedback. The instruction field supports markdown format including headers, lists, code blocks (with syntax highlighting), bold, italic, links, and more.",
  //     inputSchema: tellHumanToDoInputSchema.shape
  //   },
  //   async (args: { instruction: string }) => {
  //     const result = await handleTellHumanToDo(args);
  //
  //     return {
  //       content: [
  //         {
  //           type: "text",
  //           text: JSON.stringify(result)
  //         }
  //       ],
  //       structuredContent: result
  //     };
  //   }
  // );

  server.registerTool(
    "prompt-form",
    {
      title: "Prompt Form",
      description:
        "Show a structured form in the desktop app and return structured user input plus free-form feedback.",
      inputSchema: promptFormInputSchema.shape
    },
    async (args: PromptFormInput) => {
      const result = await handlePromptForm(args);

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

  server.registerTool(
    "wait-for-prompt",
    {
      title: "Wait For Prompt",
      description:
        "Continue waiting on an existing prompt UUID after receiving a keep-waiting response.",
      inputSchema: waitForPromptInputSchema.shape
    },
    async (args: WaitForPromptInput) => {
      const result = await handleWaitForPrompt(args);

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
