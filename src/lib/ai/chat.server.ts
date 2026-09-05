import { createServerFn } from "@tanstack/react-start";

import { chatWithGemini } from "./gemini.server";
import { ChatRequestSchema } from "./types";

export const chatWithGeminiServer = createServerFn({ method: "POST" })
  .validator(ChatRequestSchema)
  .handler(async ({ data }) => chatWithGemini(data));
