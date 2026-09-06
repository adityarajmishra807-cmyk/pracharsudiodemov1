import { useEffect, useRef, useState } from "react";

import { mediaService } from "../services/media.service";
import type { WhatsAppMessage } from "../core/types";

export function useWhatsAppMedia(sessionId: string | null) {
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const generationRef = useRef(0);

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    setToken(null);
    setUrl(null);
    if (!sessionId) return;

    setLoading(true);
    void mediaService.token({ data: { sessionIds: [sessionId] } })
      .then((result) => {
        if (generation !== generationRef.current) return;
        setToken(result.token);
        setUrl(result.url);
      })
      .catch(() => {
        if (generation === generationRef.current) {
          setToken(null);
          setUrl(null);
        }
      })
      .finally(() => {
        if (generation === generationRef.current) setLoading(false);
      });
  }, [sessionId]);

  const mediaUrl = (message: WhatsAppMessage) => {
    if (!token || !url || !message.mediaPath) return null;
    return mediaService.url(url, message.sessionId, message.jid, message.messageId, token);
  };

  return { token, url, loading, mediaUrl };
}
