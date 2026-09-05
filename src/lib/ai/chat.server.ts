import { createServerFn } from "@tanstack/react-start";

import { chatWithGemini } from "./gemini.server";
import { ChatRequestSchema } from "./types";

export const chatWithGeminiServer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ChatRequestSchema.parse(input))
  .handler(async ({ data }) => chatWithGemini(data));
