import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const DEFAULT_SERVER_PORT = 43118;

function resolveServerPort(): number {
  const rawPort =
    process.env.I_AM_MCP_SERVER_PORT ?? process.env.I_AM_MCP_CONTROL_PORT;

  if (!rawPort) {
    return DEFAULT_SERVER_PORT;
  }

  const port = Number(rawPort);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid backend port: ${rawPort}`);
  }

  return port;
}

async function main(): Promise<void> {
  const transport = new StreamableHTTPClientTransport(
    new URL(`http://127.0.0.1:${resolveServerPort()}/mcp`)
  );

  const client = new Client({
    name: "prompt-gui-mcp-simulator",
    version: "0.1.2"
  });

  await client.connect(transport);

  const tools = await client.listTools();
  console.log("Registered tools:", tools.tools.map((tool) => tool.name));

  const selectedTool = process.argv[2] ?? "tell-human-to-do";
  const toolName =
    selectedTool === "prompt-form" ||
    selectedTool === "tell-human-to-do" ||
    selectedTool === "wait-for-prompt"
      ? selectedTool
      : "tell-human-to-do";
  const promptUuidArg = process.argv[3];

  if (toolName === "wait-for-prompt" && !promptUuidArg) {
    throw new Error("Usage: pnpm --filter backend simulate -- wait-for-prompt <promptUuid>");
  }

  const response = await client.callTool(
    toolName === "prompt-form"
      ? {
          name: toolName,
          arguments: {
            title: "Choose deployment target",
            description: "Review the release and submit the form.",
            form: {
              version: "1",
              fields: [
                {
                  type: "markdown",
                  id: "release_notes",
                  content: "## Release\n\n- Commit: `a1b2c3d`\n- Branch: `main`"
                },
                {
                  type: "image",
                  id: "release_diagram",
                  url: "https://placehold.co/1200x700/png?text=Release+Diagram",
                  alt: "Release architecture diagram"
                },
                {
                  type: "radio",
                  id: "environment",
                  label: "Environment",
                  required: true,
                  options: [
                    { label: "Staging", value: "staging" },
                    { label: "Production", value: "production" }
                  ]
                },
                {
                  type: "text",
                  id: "ticket",
                  label: "Change ticket",
                  required: false,
                  placeholder: "CHG-1234"
                }
              ]
            }
          }
        }
      : toolName === "wait-for-prompt"
        ? {
            name: toolName,
            arguments: {
              promptUuid: promptUuidArg
            }
          }
      : {
          name: toolName,
          arguments: {
            instruction: "Please check inbox and provide OTP"
          }
        }
  );

  console.log("Tool call response:");
  console.log(JSON.stringify(response.structuredContent, null, 2));

  if (
    response.structuredContent &&
    typeof response.structuredContent === "object" &&
    "type" in response.structuredContent &&
    response.structuredContent.type === "keep-waiting"
  ) {
    const keepWaiting = response.structuredContent as {
      type: "keep-waiting";
      promptUuid: string;
    };

    console.log("\nFollow-up example:");
    console.log(
      `pnpm --filter backend simulate -- wait-for-prompt ${keepWaiting.promptUuid}`
    );
  }

  await client.close();
}

main().catch((error: unknown) => {
  console.error("Simulation failed", error);
  process.exit(1);
});
