import { z } from "zod";
import { logger } from "../logger.js";
import { TaskQueueError } from "../services/task-queue.js";
import { taskQueue } from "../services/runtime.js";
import type { TaskResult } from "../types.js";

export const waitForPromptInputSchema = z.object({
  promptUuid: z.string().uuid("promptUuid must be a valid UUID")
});

export type WaitForPromptInput = z.infer<typeof waitForPromptInputSchema>;

export async function handleWaitForPrompt(rawInput: unknown): Promise<TaskResult> {
  const input = waitForPromptInputSchema.parse(rawInput);

  logger.info(
    {
      tool: "wait-for-prompt",
      promptUuid: input.promptUuid
    },
    "MCP tool called"
  );

  try {
    return await taskQueue.waitForPrompt(input.promptUuid);
  } catch (error) {
    if (error instanceof TaskQueueError) {
      logger.warn(
        { promptUuid: input.promptUuid, code: error.code },
        "wait-for-prompt rejected"
      );
      throw new Error(`${error.code}: ${error.message}`);
    }

    throw error;
  }
}
