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

export const TemplateActionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60),
  body: z.string().trim().min(1).max(4000),
});

export const LeadActionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().max(40).default(""),
  email: z.string().max(160).default(""),
  company: z.string().max(160).default(""),
  source: z.string().max(60).default("Other"),
  status: z.enum(["new", "contacted", "qualified", "won", "lost"]).default("new"),
  tags: z.array(z.string().max(40)).max(10).default([]),
  notes: z.string().max(2000).default(""),
});

export const LeadStatusActionSchema = z.object({
  leadId: z.string().min(1).max(100),
  status: z.enum(["new", "contacted", "qualified", "won", "lost"]),
});

export const CampaignActionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  status: z.enum(["draft", "scheduled", "running", "completed"]).default("draft"),
  templateId: z.string().max(100).nullable().default(null),
  audienceStatus: z.enum(["all", "new", "contacted", "qualified", "won", "lost"]).default("all"),
  audienceTag: z.string().max(60).nullable().default(null),
});

export const AutomationActionSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const ChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(12000),
  history: z.array(ChatMessageSchema).max(30).default([]),
  context: PracharContextSchema,
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export type PracharAction =
  | { name: "create_template"; args: z.infer<typeof TemplateActionSchema> }
  | { name: "create_lead"; args: z.infer<typeof LeadActionSchema> }
  | { name: "update_lead_status"; args: z.infer<typeof LeadStatusActionSchema> }
  | { name: "create_campaign"; args: z.infer<typeof CampaignActionSchema> }
  | { name: "create_automation"; args: z.infer<typeof AutomationActionSchema> };

export type ChatResponse = {
  text: string;
  model: string;
  action?: PracharAction;
};
