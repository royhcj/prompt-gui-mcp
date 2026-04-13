import { z } from "zod";
import { logger } from "../logger.js";
import { taskQueue } from "../services/runtime.js";
import type { PromptFormResult } from "../types.js";

const nonEmptyString = z.string().trim().min(1);

const promptFormOptionSchema = z.object({
  label: nonEmptyString,
  value: nonEmptyString,
  description: z.string().trim().min(1).optional()
});

const checkboxOptionTextInputSchema = z.object({
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
  required: z.boolean().optional()
});

const promptFormCheckboxOptionSchema = promptFormOptionSchema.extend({
  textInput: checkboxOptionTextInputSchema.optional()
});

const fieldBaseSchema = {
  id: nonEmptyString,
  helpText: z.string().trim().min(1).optional(),
  required: z.boolean(),
  disabled: z.boolean().optional()
} as const;

const markdownFieldSchema = z.object({
  type: z.literal("markdown"),
  id: nonEmptyString,
  content: nonEmptyString
});

const textFieldSchema = z.object({
  type: z.literal("text"),
  ...fieldBaseSchema,
  label: nonEmptyString,
  defaultValue: z.string().optional(),
  placeholder: z.string().optional()
});

const textareaFieldSchema = z.object({
  type: z.literal("textarea"),
  ...fieldBaseSchema,
  label: nonEmptyString,
  defaultValue: z.string().optional(),
  placeholder: z.string().optional(),
  rows: z.number().int().positive().optional()
});

const radioFieldSchema = z.object({
  type: z.literal("radio"),
  ...fieldBaseSchema,
  label: nonEmptyString,
  defaultValue: z.string().optional(),
  options: z.array(promptFormOptionSchema).min(1, "options must not be empty")
});

const selectFieldSchema = z.object({
  type: z.literal("select"),
  ...fieldBaseSchema,
  label: nonEmptyString,
  defaultValue: z.string().optional(),
  placeholder: z.string().optional(),
  options: z.array(promptFormOptionSchema).min(1, "options must not be empty")
});

const checkboxListFieldSchema = z.object({
  type: z.literal("checkbox-list"),
  ...fieldBaseSchema,
  label: nonEmptyString,
  defaultValue: z.array(z.string()).optional(),
  options: z.array(promptFormCheckboxOptionSchema).min(1, "options must not be empty")
});

const promptFormFieldSchema = z.discriminatedUnion("type", [
  markdownFieldSchema,
  textFieldSchema,
  textareaFieldSchema,
  radioFieldSchema,
  selectFieldSchema,
  checkboxListFieldSchema
]);

const promptFormDefinitionSchema = z
  .object({
    version: z.literal("1"),
    fields: z.array(promptFormFieldSchema).min(1, "form must include at least one field")
  })
  .superRefine((form, context) => {
    const fieldIds = new Set<string>();

    for (const [index, field] of form.fields.entries()) {
      if (fieldIds.has(field.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `field ids must be unique; duplicate '${field.id}'`,
          path: ["fields", index, "id"]
        });
      }

      fieldIds.add(field.id);

      if (
        field.type === "radio" ||
        field.type === "select" ||
        field.type === "checkbox-list"
      ) {
        const optionValues = new Set<string>();

        for (const [optionIndex, option] of field.options.entries()) {
          if (optionValues.has(option.value)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: `option values must be unique for field '${field.id}'`,
              path: ["fields", index, "options", optionIndex, "value"]
            });
          }

          optionValues.add(option.value);
        }

        if (
          (field.type === "radio" || field.type === "select") &&
          field.defaultValue &&
          !optionValues.has(field.defaultValue)
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `defaultValue must match an option value for field '${field.id}'`,
            path: ["fields", index, "defaultValue"]
          });
        }

        if (field.type === "checkbox-list" && field.defaultValue) {
          const selectedValues = new Set<string>();

          for (const [valueIndex, value] of field.defaultValue.entries()) {
            if (selectedValues.has(value)) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                message: `defaultValue must not include duplicate values for field '${field.id}'`,
                path: ["fields", index, "defaultValue", valueIndex]
              });
            }

            selectedValues.add(value);

            if (!optionValues.has(value)) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                message: `defaultValue must match option values for field '${field.id}'`,
                path: ["fields", index, "defaultValue", valueIndex]
              });
            }
          }
        }
      }
    }
  });

export const promptFormInputSchema = z.object({
  title: nonEmptyString,
  description: z.string().optional(),
  submitLabel: z.string().trim().min(1).optional(),
  cancelLabel: z.string().trim().min(1).optional(),
  form: promptFormDefinitionSchema
});

export type PromptFormInput = z.infer<typeof promptFormInputSchema>;

export async function handlePromptForm(rawInput: unknown): Promise<PromptFormResult> {
  const input = promptFormInputSchema.parse(rawInput);

  logger.info(
    {
      tool: "prompt-form",
      title: input.title,
      fieldCount: input.form.fields.length,
      fieldIds: input.form.fields.map((field) => field.id)
    },
    "MCP tool called"
  );

  return taskQueue.enqueuePromptForm({
    title: input.title,
    description: input.description,
    submitLabel: input.submitLabel ?? "Submit",
    cancelLabel: input.cancelLabel ?? "Cancel",
    form: input.form
  });
}
