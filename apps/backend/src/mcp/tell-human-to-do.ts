import { z } from "zod";
import { logger } from "../logger.js";

export const tellHumanToDoInputSchema = z.object({
  instruction: z.string().min(1, "instruction is required")
});

export type TellHumanToDoInput = z.infer<typeof tellHumanToDoInputSchema>;

export type TellHumanToDoResult = {
  status: "completed" | "failed";
  feedback: string;
};

export async function handleTellHumanToDo(
  rawInput: unknown
): Promise<TellHumanToDoResult> {
  const input = tellHumanToDoInputSchema.parse(rawInput);

  logger.info(
    {
      tool: "tell-human-to-do",
      instruction: input.instruction
    },
    "MCP tool called"
  );

  return {
    status: "completed",
    feedback: `Mock response: human received instruction \"${input.instruction}\"`
  };
}
