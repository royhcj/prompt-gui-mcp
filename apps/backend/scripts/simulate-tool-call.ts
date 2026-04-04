import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

function inheritedEnv(): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }

  return env;
}

async function main(): Promise<void> {
  const controlPort = process.env.I_AM_MCP_CONTROL_PORT;
  const env = inheritedEnv();

  if (controlPort) {
    env.I_AM_MCP_CONTROL_PORT = controlPort;
  }

  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/src/index.js"],
    env
  });

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
