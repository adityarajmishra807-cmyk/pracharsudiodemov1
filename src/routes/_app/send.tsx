import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileUp, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSessions } from "@/hooks/use-sessions";
import { sessionsApi, type MediaPayload } from "@/lib/sessions-api";

export const Route = createFileRoute("/_app/send")({ component: SendPage });

const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

function mediaType(file: File): MediaPayload["mediatype"] | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("application/") || file.type.startsWith("text/")) return "document";
  return null;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.replace(/^data:[^;]+;base64,/, ""));
    };
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function SendPage() {
  const { data: sessions = [] } = useSessions();
  const connected = useMemo(
    () => sessions.filter((s: any) => ["open", "connected", "online"].includes(String(s.state || s.status || "").toLowerCase())),
    [sessions],
  );
  const [instance, setInstance] = useState("");
  const [number, setNumber] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  const send = async () => {
    if (!instance || !number.trim() || (!text.trim() && !file)) return;
    setBusy(true);
    setResult("");
    try {
      if (file) {
        if (file.size > MAX_MEDIA_BYTES) throw new Error("Media must be 8 MB or smaller.");
        const type = mediaType(file);
        if (!type) throw new Error("Unsupported media type. Use an image, video, or document.");
        const media: MediaPayload = {
          base64: await fileToBase64(file),
          mediatype: type,
          mimetype: file.type || "application/octet-stream",
          fileName: file.name,
        };
        await sessionsApi.sendMedia(instance, number, media, text.trim());
        setResult("Media sent successfully.");
      } else {
        await sessionsApi.sendText(instance, number, text.trim());
        setResult("Message sent successfully.");
      }
      setText("");
      setFile(null);
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Message failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <p className="text-xs font-semibold tracking-wider text-primary">WHATSAPP</p>
        <h1 className="text-2xl font-bold text-navy">Send Message</h1>
        <p className="text-sm text-muted-foreground">Send text, images, videos, or documents through a connected Evolution instance.</p>
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-white p-5">
        <select className="h-10 w-full rounded-md border px-3 text-sm" value={instance} onChange={(e) => setInstance(e.target.value)}>
          <option value="">Select connected instance</option>
          {connected.map((s: any) => <option key={s.instanceName} value={s.instanceName}>{s.instanceName}</option>)}
        </select>
        <Input placeholder="919999999999" value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={15} />
        <Textarea placeholder={file ? "Optional caption" : "Message"} value={text} onChange={(e) => setText(e.target.value)} />
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-4 text-sm hover:bg-surface">
          <FileUp className="size-5 text-primary" />
          <span className="min-w-0 flex-1 truncate">{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : "Attach image, video, or document (max 8 MB)"}</span>
          <input className="sr-only" type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <Button disabled={busy || !instance || !/^\d{8,15}$/.test(number) || (!text.trim() && !file)} onClick={() => void send()}>
          <Send className="mr-2 size-4" />{busy ? "Sending…" : file ? "Send media" : "Send message"}
        </Button>
        {result && <p className="text-sm text-muted-foreground">{result}</p>}
      </div>
    </div>
  );
}