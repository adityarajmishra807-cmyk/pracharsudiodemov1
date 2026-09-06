import { useCallback, useEffect, useRef } from "react";

export type WhatsAppPollingState = "idle" | "loading" | "refreshing" | "loadingOlder" | "error" | "ready";

export function useWhatsAppPolling<T>(
  fetcher: () => Promise<T>,
  options: { pollMs: number; enabled?: boolean; onSuccess?: (value: T) => void; onError?: (error: unknown) => void },
) {
  const enabled = options.enabled ?? true;
  const pollMs = options.pollMs;
  const fetcherRef = useRef(fetcher);
  const onSuccessRef = useRef(options.onSuccess);
  const onErrorRef = useRef(options.onError);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);

  useEffect(() => { fetcherRef.current = fetcher; }, [fetcher]);
  useEffect(() => { onSuccessRef.current = options.onSuccess; }, [options.onSuccess]);
  useEffect(() => { onErrorRef.current = options.onError; }, [options.onError]);

  const run = useCallback(async () => {
    if (!enabled || inFlightRef.current) return null;
    inFlightRef.current = true;
    try {
      const value = await fetcherRef.current();
      if (mountedRef.current) onSuccessRef.current?.(value);
      return value;
    } catch (error) {
      if (mountedRef.current) onErrorRef.current?.(error);
      throw error;
    } finally {
      inFlightRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    mountedRef.current = true;
    const generation = ++generationRef.current;
    if (!enabled) return;

    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(async () => {
        if (!mountedRef.current || generation !== generationRef.current) return;
        try { await run(); } catch { /* caller surfaces error state */ }
        if (mountedRef.current && generation === generationRef.current) schedule();
      }, pollMs);
    };
    schedule();

    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      if (timer) window.clearTimeout(timer);
    };
  }, [enabled, pollMs, run]);

  return { run, inFlightRef };
}
