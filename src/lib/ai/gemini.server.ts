import { PRACHAR_AI_PRODUCT_KNOWLEDGE } from "./knowledge";
import { PRACHAR_AI_SYSTEM_PROMPT } from "./prompt";
import {
  AutomationActionSchema,
  CampaignActionSchema,
  ChatRequest,
  ChatResponse,
  LeadActionSchema,
  LeadStatusActionSchema,
  PracharAction,
  TemplateActionSchema,
} from "./types";

const DEFAULT_MODEL = "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.6-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_ATTEMPTS_PER_MODEL = 2;

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "create_template",
        description:
          "Create a new Prachar message template. Use this when the user asks to generate, write, draft, or create a template. The application will ask the user to review and approve it before saving.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Short template name" },
            category: {
              type: "string",
              enum: ["Welcome", "Follow-up", "Appointment", "Offer", "Payment", "Support"],
            },
            body: {
              type: "string",
              description: "Template message body. Use {{name}} when personalization is useful.",
            },
          },
          required: ["name", "category", "body"],
        },
      },
      {
        name: "create_lead",
        description:
          "Create a CRM lead from details supplied by the user. The application will ask for approval before saving.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            phone: { type: "string" },
            email: { type: "string" },
            company: { type: "string" },
            source: { type: "string" },
            status: { type: "string", enum: ["new", "contacted", "qualified", "won", "lost"] },
            tags: { type: "array", items: { type: "string" } },
            notes: { type: "string" },
          },
          required: ["name"],
        },
      },
      {
        name: "update_lead_status",
        description:
          "Change the status of an existing lead when the user explicitly asks to move it in the pipeline. The application will ask for approval before saving.",
        parameters: {
          type: "object",
          properties: {
            leadId: { type: "string", description: "Existing lead ID" },
            status: { type: "string", enum: ["new", "contacted", "qualified", "won", "lost"] },
          },
          required: ["leadId", "status"],
        },
      },
      {
        name: "create_campaign",
        description:
          "Create a draft campaign. Use this when the user asks the assistant to prepare a campaign. Never claim it was sent or scheduled; the application will require approval.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            status: { type: "string", enum: ["draft", "scheduled", "running", "completed"] },
            templateId: { type: ["string", "null"] },
            audienceStatus: {
              type: "string",
              enum: ["all", "new", "contacted", "qualified", "won", "lost"],
            },
            audienceTag: { type: ["string", "null"] },
          },
          required: ["name"],
        },
      },
      {
        name: "create_automation",
        description:
          "Create a new draft automation shell when the user asks to create an automation. The application will ask for approval before saving.",
        parameters: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"],
        },
      },
    ],
  },
];

function getConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server");
  }
  return { apiKey, model: process.env.GEMINI_MODEL || DEFAULT_MODEL };
}

function buildContents(input: ChatRequest) {
  const history = input.history.map((message) => ({
    role: message.role,
    parts: [{ text: message.content }],
  }));
  const contextBlock = input.context
    ? `\n\nPrachar workspace context:\n${JSON.stringify(input.context)}`
    : "";
  return [
    ...history,
    {
      role: "user" as const,
      parts: [{ text: `${input.message}${contextBlock}` }],
    },
  ];
}

function parseAction(name: string, rawArgs: unknown): PracharAction | null {
  if (name === "create_template") return { name, args: TemplateActionSchema.parse(rawArgs) };
  if (name === "create_lead") return { name, args: LeadActionSchema.parse(rawArgs) };
  if (name === "update_lead_status") return { name, args: LeadStatusActionSchema.parse(rawArgs) };
  if (name === "create_campaign") return { name, args: CampaignActionSchema.parse(rawArgs) };
  if (name === "create_automation") return { name, args: AutomationActionSchema.parse(rawArgs) };
  return null;
}

async function requestModel(input: ChatRequest, apiKey: string, model: string) {
  const systemInstruction = `${PRACHAR_AI_SYSTEM_PROMPT}\n\n${PRACHAR_AI_PRODUCT_KNOWLEDGE}\n\nACTION MODE: When the user asks you to create or modify something inside Prachar, use the appropriate function. Do not execute the function yourself; return the function call for the application to review and approve. Prefer create_template for template-generation requests.`;

  for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_MODEL; attempt += 1) {
    const response = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: buildContents(input),
        tools: TOOLS,
        toolConfig: { functionCallingConfig: { mode: "AUTO" } },
        generationConfig: { maxOutputTokens: 1400 },
      }),
    });

    if (!response.ok) {
      let detail = "Gemini request failed";
      try {
        const body = (await response.json()) as { error?: { message?: string } };
        detail = body.error?.message || detail;
      } catch {
        // Keep generic detail.
      }
      const retryable = [408, 429, 500, 502, 503, 504].includes(response.status);
      if (!retryable || attempt === MAX_ATTEMPTS_PER_MODEL - 1) return { retryable, detail };
      await new Promise((resolve) => setTimeout(resolve, Math.min(500 * 2 ** attempt, 4000)));
      continue;
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            functionCall?: { name?: string; args?: unknown };
          }>;
        };
      }>;
    };

    const parts = payload.candidates?.[0]?.content?.parts ?? [];
    const functionPart = parts.find((part) => part.functionCall?.name);
    if (functionPart?.functionCall?.name) {
      const action = parseAction(functionPart.functionCall.name, functionPart.functionCall.args ?? {});
      if (action) return { retryable: false, text: "", action };
    }

    const text = parts.map((part) => part.text || "").join("").trim();
    if (text) return { retryable: false, text };
    return { retryable: true, detail: "Gemini returned an empty response" };
  }

  return { retryable: true, detail: "Gemini request failed after retries" };
}

export async function chatWithGemini(input: ChatRequest): Promise<ChatResponse> {
  const { apiKey, model } = getConfig();
  const models = model === FALLBACK_MODEL ? [model] : [model, FALLBACK_MODEL];
  let lastDetail = "Gemini is temporarily unavailable";

  for (const candidate of models) {
    const result = await requestModel(input, apiKey, candidate);
    if (result.action) return { text: "", model: candidate, action: result.action };
    if (result.text) return { text: result.text, model: candidate };
    if (result.detail) lastDetail = result.detail;
    if (!result.retryable) break;
  }

  throw new Error("Prachar AI is temporarily busy. Please try again in a moment.", { cause: lastDetail });
}
