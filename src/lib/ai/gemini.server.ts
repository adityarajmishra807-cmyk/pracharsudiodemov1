import { PRACHAR_AI_PRODUCT_KNOWLEDGE } from "./knowledge";
import { PRACHAR_AI_SYSTEM_PROMPT } from "./prompt";
import type { ChatRequest, ChatResponse } from "./types";

const DEFAULT_MODEL = "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.6-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_ATTEMPTS_PER_MODEL = 2;

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

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function retryDelayMs(attempt: number, retryAfterHeader: string | null) {
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.min(retryAfterSeconds * 1000, 8000);
  }

  return Math.min(500 * 2 ** attempt, 4000);
}

async function requestModel(
  input: ChatRequest,
  apiKey: string,
  model: string,
): Promise<{ text: string; retryable: boolean; detail?: string }> {
  const systemInstruction = `${PRACHAR_AI_SYSTEM_PROMPT}\n\n${PRACHAR_AI_PRODUCT_KNOWLEDGE}`;

  for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_MODEL; attempt += 1) {
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

      const retryable = isRetryableStatus(response.status);
      if (!retryable || attempt === MAX_ATTEMPTS_PER_MODEL - 1) {
        return { text: "", retryable, detail };
      }

      await new Promise((resolve) => {
        setTimeout(resolve, retryDelayMs(attempt, response.headers.get("retry-after")));
      });
      continue;
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

    if (text) {
      return { text, retryable: false };
    }

    return { text: "", retryable: true, detail: "Gemini returned an empty response" };
  }

  return { text: "", retryable: true, detail: "Gemini request failed after retries" };
}

export async function chatWithGemini(input: ChatRequest): Promise<ChatResponse> {
  const { apiKey, model } = getConfig();
  const models = model === FALLBACK_MODEL ? [model] : [model, FALLBACK_MODEL];
  let lastDetail = "Gemini is temporarily unavailable";

  for (const candidate of models) {
    const result = await requestModel(input, apiKey, candidate);
    if (result.text) {
      return { text: result.text, model: candidate };
    }

    if (result.detail) lastDetail = result.detail;
    if (!result.retryable) break;
  }

  throw new Error(
    "Prachar AI is temporarily busy. Please try again in a moment.",
    { cause: lastDetail },
  );
}
