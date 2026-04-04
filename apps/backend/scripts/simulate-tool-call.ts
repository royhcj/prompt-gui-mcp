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
    name: "i-am-mcp-simulator",
    version: "0.1.0"
  });

  await client.connect(transport);

  const tools = await client.listTools();
  console.log("Registered tools:", tools.tools.map((tool) => tool.name));

  const response = await client.callTool({
    name: "tell-human-to-do",
    arguments: {
      instruction: "Please check inbox and provide OTP"
    }
  });

  console.log("Tool call response:");
  console.log(JSON.stringify(response.structuredContent, null, 2));

  await client.close();
}

main().catch((error: unknown) => {
  console.error("Simulation failed", error);
  process.exit(1);
});
