import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileUp, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSessions } from "@/hooks/use-sessions";
import { sessionsApi, type ButtonPayload, type ListRow, type ListSection, type MediaPayload } from "@/lib/sessions-api";

export const Route = createFileRoute("/_app/send")({ component: SendPage });

const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
type MessageType = "text" | "media" | "buttons" | "list";

function mediaType(file: File): MediaPayload["mediatype"] | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("application/") || file.type.startsWith("text/")) return "document";
  return null;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").replace(/^data:[^;]+;base64,/, ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

const newButton = (): ButtonPayload => ({ id: crypto.randomUUID(), displayText: "" });
const newRow = (): ListRow => ({ title: "", rowId: crypto.randomUUID(), description: "" });
const newSection = (): ListSection => ({ title: "", rows: [newRow()] });

function SendPage() {
  const { data: sessions = [] } = useSessions();
  const connected = useMemo(() => sessions.filter((s: any) => ["open", "connected", "online"].includes(String(s.state || s.status || "").toLowerCase())), [sessions]);
  const [instance, setInstance] = useState("");
  const [number, setNumber] = useState("");
  const [type, setType] = useState<MessageType>("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [footer, setFooter] = useState("");
  const [buttonText, setButtonText] = useState("Choose");
  const [buttons, setButtons] = useState<ButtonPayload[]>([newButton()]);
  const [sections, setSections] = useState<ListSection[]>([newSection()]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  const send = async () => {
    if (!instance || !/^\d{8,15}$/.test(number)) return;
    setBusy(true); setResult("");
    try {
      if (type === "text") {
        if (!text.trim()) throw new Error("Message text is required.");
        await sessionsApi.sendText(instance, number, text.trim());
      } else if (type === "media") {
        if (!file) throw new Error("Attach a file first.");
        if (file.size > MAX_MEDIA_BYTES) throw new Error("Media must be 8 MB or smaller.");
        const mediatype = mediaType(file);
        if (!mediatype) throw new Error("Unsupported media type. Use an image, video, or document.");
        await sessionsApi.sendMedia(instance, number, { base64: await fileToBase64(file), mediatype, mimetype: file.type || "application/octet-stream", fileName: file.name }, text.trim());
      } else if (type === "buttons") {
        const validButtons = buttons.filter((b) => b.displayText.trim()).map((b, i) => ({ id: b.id || String(i + 1), displayText: b.displayText.trim() }));
        if (!title.trim()) throw new Error("Button title is required.");
        if (!validButtons.length || validButtons.length > 3) throw new Error("Buttons require 1–3 items.");
        await sessionsApi.sendButtons(instance, number, { title: title.trim(), description: description.trim(), footer: footer.trim(), buttons: validButtons });
      } else {
        const validSections = sections.map((s) => ({ title: s.title?.trim(), rows: s.rows.filter((r) => r.title.trim()).map((r, i) => ({ title: r.title.trim(), rowId: r.rowId || String(i + 1), description: r.description?.trim() })) })).filter((s) => s.rows.length);
        const rowCount = validSections.reduce((n, s) => n + s.rows.length, 0);
        if (!title.trim()) throw new Error("List title is required.");
        if (!buttonText.trim()) throw new Error("List button text is required.");
        if (!rowCount || rowCount > 10) throw new Error("Lists require 1–10 rows.");
        await sessionsApi.sendList(instance, number, { title: title.trim(), description: description.trim(), footerText: footer.trim(), buttonText: buttonText.trim(), sections: validSections });
      }
      setResult("Message sent successfully.");
      setText(""); setFile(null); setTitle(""); setDescription(""); setFooter("");
    } catch (e) { setResult(e instanceof Error ? e.message : "Message failed."); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div><p className="text-xs font-semibold tracking-wider text-primary">WHATSAPP</p><h1 className="text-2xl font-bold text-navy">Send Message</h1><p className="text-sm text-muted-foreground">Send text, media, buttons, or interactive lists through a connected Evolution instance.</p></div>
      <div className="space-y-4 rounded-xl border border-border bg-white p-5">
        <select className="h-10 w-full rounded-md border px-3 text-sm" value={instance} onChange={(e) => setInstance(e.target.value)}><option value="">Select connected instance</option>{connected.map((s: any) => <option key={s.instanceName} value={s.instanceName}>{s.instanceName}</option>)}</select>
        <Input placeholder="919999999999" value={number} onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={15} />
        <select className="h-10 w-full rounded-md border px-3 text-sm" value={type} onChange={(e) => setType(e.target.value as MessageType)}><option value="text">Text</option><option value="media">Media</option><option value="buttons">Buttons</option><option value="list">List</option></select>

        {type === "text" && <Textarea placeholder="Message" value={text} onChange={(e) => setText(e.target.value)} />}

        {type === "media" && <>
          <Textarea placeholder="Optional caption" value={text} onChange={(e) => setText(e.target.value)} />
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-4 text-sm hover:bg-surface"><FileUp className="size-5 text-primary" /><span className="min-w-0 flex-1 truncate">{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : "Attach image, video, or document (max 8 MB)"}</span><input className="sr-only" type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
        </>}

        {(type === "buttons" || type === "list") && <>
          <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Input placeholder="Footer (optional)" value={footer} onChange={(e) => setFooter(e.target.value)} />
        </>}

        {type === "buttons" && <div className="space-y-2 rounded-lg border p-3"><div className="flex items-center justify-between"><span className="text-sm font-semibold">Buttons (max 3)</span><Button type="button" variant="outline" size="sm" disabled={buttons.length >= 3} onClick={() => setButtons([...buttons, newButton()])}><Plus className="mr-1 size-4" />Add</Button></div>{buttons.map((b, i) => <div className="flex gap-2" key={b.id}><Input placeholder={`Button ${i + 1} text`} value={b.displayText} onChange={(e) => setButtons(buttons.map((x) => x.id === b.id ? {...x, displayText: e.target.value} : x))} />{buttons.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setButtons(buttons.filter((x) => x.id !== b.id))}><Trash2 className="size-4" /></Button>}</div>)}</div>}

        {type === "list" && <div className="space-y-3 rounded-lg border p-3"><Input placeholder="List button text" value={buttonText} onChange={(e) => setButtonText(e.target.value)} /><div className="flex items-center justify-between"><span className="text-sm font-semibold">Sections</span><Button type="button" variant="outline" size="sm" onClick={() => setSections([...sections, newSection()])}><Plus className="mr-1 size-4" />Section</Button></div>{sections.map((section, si) => <div className="space-y-2 rounded-md border p-3" key={si}><div className="flex gap-2"><Input placeholder={`Section ${si + 1} title`} value={section.title || ""} onChange={(e) => setSections(sections.map((s, i) => i === si ? {...s, title: e.target.value} : s))} />{sections.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setSections(sections.filter((_, i) => i !== si))}><Trash2 className="size-4" /></Button>}</div>{section.rows.map((row, ri) => <div className="space-y-2 rounded border p-2" key={row.rowId}><div className="flex gap-2"><Input placeholder="Row title" value={row.title} onChange={(e) => setSections(sections.map((s, i) => i === si ? {...s, rows: s.rows.map((r, j) => j === ri ? {...r, title: e.target.value} : r)} : s))} /><Button type="button" variant="ghost" size="icon" onClick={() => setSections(sections.map((s, i) => i === si ? {...s, rows: s.rows.filter((_, j) => j !== ri)} : s))}><Trash2 className="size-4" /></Button></div><Input placeholder="Row description (optional)" value={row.description || ""} onChange={(e) => setSections(sections.map((s, i) => i === si ? {...s, rows: s.rows.map((r, j) => j === ri ? {...r, description: e.target.value} : r)} : s))} /></div>)}<Button type="button" variant="outline" size="sm" onClick={() => setSections(sections.map((s, i) => i === si ? {...s, rows: [...s.rows, newRow()]} : s))}><Plus className="mr-1 size-4" />Row</Button></div>)}</div>}

        <Button disabled={busy || !instance || !/^\d{8,15}$/.test(number)} onClick={() => void send()}><Send className="mr-2 size-4" />{busy ? "Sending…" : "Send message"}</Button>
        {result && <p className="text-sm text-muted-foreground">{result}</p>}
      </div>
    </div>
  );
}