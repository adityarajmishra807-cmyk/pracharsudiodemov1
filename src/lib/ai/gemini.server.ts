import { PRACHAR_AI_PRODUCT_KNOWLEDGE } from "./knowledge";
import { PRACHAR_AI_SYSTEM_PROMPT } from "./prompt";
import type { ChatRequest, ChatResponse } from "./types";

const DEFAULT_MODEL = "gemini-3.8-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function getConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server");
  }

  return {
    apiKey,
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
  };
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

export async function chatWithGemini(input: ChatRequest): Promise<ChatResponse> {
  const { apiKey, model } = getConfig();
  const systemInstruction = `${PRACHAR_AI_SYSTEM_PROMPT}\n\n${PRACHAR_AI_PRODUCT_KNOWLEDGE}`;

  const response = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: buildContents(input),
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 1200,
      },
    }),
  });

  if (!response.ok) {
    let detail = "Gemini request failed";
    try {
      const errorBody = (await response.json()) as {
        error?: { message?: string };
      };
      detail = errorBody.error?.message || detail;
    } catch {
      // Keep the generic message when the provider response isn't JSON.
    }
    throw new Error(detail);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return { text, model };
}
