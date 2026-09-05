import { z } from "zod";

export const ChatRoleSchema = z.enum(["user", "model"]);

export const ChatMessageSchema = z.object({
  role: ChatRoleSchema,
  content: z.string().trim().min(1).max(12000),
});

export const PracharContextSchema = z
  .object({
    workspaceName: z.string().max(200).optional(),
    page: z.string().max(200).optional(),
    summary: z.string().max(12000).optional(),
  })
  .optional();

export const ChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(12000),
  history: z.array(ChatMessageSchema).max(30).default([]),
  context: PracharContextSchema,
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export type ChatResponse = {
  text: string;
  model: string;
};
