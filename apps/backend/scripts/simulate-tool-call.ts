import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/src/index.js"]
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
