import { z } from "zod";
import { logger } from "../logger.js";
import { taskQueue } from "../services/runtime.js";
export const tellHumanToDoInputSchema = z.object({
  instruction: z.string().min(1, "instruction is required")
});

export type TellHumanToDoInput = z.infer<typeof tellHumanToDoInputSchema>;

export async function handleTellHumanToDo(
  rawInput: unknown
): Promise<import("../types.js").TellHumanToDoResult> {
  const input = tellHumanToDoInputSchema.parse(rawInput);

  logger.info(
    {
      tool: "tell-human-to-do",
      instruction: input.instruction
    },
    "MCP tool called"
  );

  return taskQueue.enqueue(input.instruction);
}
