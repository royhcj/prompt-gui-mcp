import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { logger } from "../logger.js";
import { taskQueue } from "../services/runtime.js";
import type { HumanTaskState, SubmitTaskResult } from "../types.js";

const DEFAULT_PORT = 43118;

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

export async function startControlServer(port = DEFAULT_PORT): Promise<void> {
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
      writeJson(response, 200, { ok: true });
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
        const body = (await readJson(request)) as Omit<SubmitTaskResult, "taskId">;
        const taskId = url.pathname.split("/")[3];

        taskQueue.submit({
          taskId,
          status: body.status,
          feedback: body.feedback ?? ""
        });

        writeJson(response, 200, { ok: true });
      } catch (error) {
        logger.error({ error }, "Failed to submit task result");
        writeJson(response, 400, {
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }

      return;
    }

    writeJson(response, 404, { error: "Not found" });
  });

  await new Promise<void>((resolve) => {
    server.listen(port, "127.0.0.1", resolve);
  });

  logger.info({ port }, "HTTP control server listening");
}
