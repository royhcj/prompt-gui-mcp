import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from "../logger.js";
import { taskQueue } from "../services/runtime.js";
import type { HumanTaskState, SubmitTaskResult } from "../types.js";

const DEFAULT_PORT = 43118;

const tellHumanToDoSubmitSchema = z.object({
  kind: z.literal("tell-human-to-do"),
  status: z.enum(["completed", "failed"]),
  feedback: z.string().optional().default("")
});

const promptFormSubmitSchema = z.object({
  kind: z.literal("prompt-form"),
  status: z.enum(["submitted", "cancelled"]),
  feedback: z.string().optional().default(""),
  values: z.record(z.string(), z.string().nullable())
});

const legacyTellHumanToDoSubmitSchema = z.object({
  status: z.enum(["completed", "failed"]),
  feedback: z.string().optional().default("")
});

function writeJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown
): void {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json"
  });
  response.end(JSON.stringify(body));
}

function writeSse(
  response: ServerResponse,
  state: HumanTaskState
): void {
  response.write(`event: state\n`);
  response.write(`data: ${JSON.stringify(state)}\n\n`);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const payload = Buffer.concat(chunks).toString("utf8");
  return payload ? JSON.parse(payload) : {};
}

function writeJsonRpcError(
  response: ServerResponse,
  statusCode: number,
  message: string
): void {
  writeJson(response, statusCode, {
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message
    },
    id: null
  });
}

type StartBackendHttpServerOptions = {
  port?: number;
  createMcpServer: () => McpServer;
};

export async function startBackendHttpServer({
  port = DEFAULT_PORT,
  createMcpServer
}: StartBackendHttpServerOptions): Promise<void> {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      });
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, {
        ok: true,
        mcpEndpoint: "/mcp"
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/state") {
      writeJson(response, 200, taskQueue.getState());
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/events") {
      response.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream"
      });

      taskQueue.setDesktopConnected(true);
      const unsubscribe = taskQueue.subscribe((state) => {
        writeSse(response, state);
      });

      request.on("close", () => {
        unsubscribe();
        taskQueue.setDesktopConnected(false);
      });

      return;
    }

    if (
      request.method === "POST" &&
      /^\/api\/tasks\/[^/]+\/result$/.test(url.pathname)
    ) {
      try {
        const rawBody = await readJson(request);
        const taskId = url.pathname.split("/")[3];
        const body = parseSubmitTaskBody(rawBody, taskId);

        taskQueue.submit(body);

        writeJson(response, 200, { ok: true });
      } catch (error) {
        logger.error({ error }, "Failed to submit task result");
        writeJson(response, 400, {
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }

      return;
    }

    if (url.pathname === "/mcp" && request.method === "POST") {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined
      });
      const mcpServer = createMcpServer();

      response.on("close", () => {
        void transport.close();
        void mcpServer.close();
      });

      try {
        const body = await readJson(request);
        await mcpServer.connect(transport);
        await transport.handleRequest(request, response, body);
      } catch (error) {
        logger.error({ error }, "Failed to process MCP request");

        if (!response.headersSent) {
          writeJson(response, 500, {
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "Internal server error"
            },
            id: null
          });
        }
      }

      return;
    }

    if (url.pathname === "/mcp" && request.method === "GET") {
      writeJsonRpcError(
        response,
        405,
        "Method not allowed. Use POST /mcp for stateless Streamable HTTP."
      );
      return;
    }

    if (url.pathname === "/mcp" && request.method === "DELETE") {
      writeJsonRpcError(
        response,
        405,
        "Method not allowed. Stateless Streamable HTTP sessions do not support DELETE."
      );
      return;
    }

    writeJson(response, 404, { error: "Not found" });
  });

  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", resolve);
  });

  logger.info({ port }, "HTTP control server listening");
}

function parseSubmitTaskBody(rawBody: unknown, taskId: string): SubmitTaskResult {
  const legacyResult = legacyTellHumanToDoSubmitSchema.safeParse(rawBody);
  if (legacyResult.success) {
    return {
      taskId,
      kind: "tell-human-to-do",
      status: legacyResult.data.status,
      feedback: legacyResult.data.feedback
    };
  }

  const tellHumanResult = tellHumanToDoSubmitSchema.safeParse(rawBody);
  if (tellHumanResult.success) {
    return {
      taskId,
      kind: tellHumanResult.data.kind,
      status: tellHumanResult.data.status,
      feedback: tellHumanResult.data.feedback
    };
  }

  const promptFormResult = promptFormSubmitSchema.safeParse(rawBody);
  if (promptFormResult.success) {
    return {
      taskId,
      kind: promptFormResult.data.kind,
      status: promptFormResult.data.status,
      feedback: promptFormResult.data.feedback,
      values: promptFormResult.data.values
    };
  }

  throw new Error("Invalid task submission payload.");
}
