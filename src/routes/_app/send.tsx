import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, FileUp, MessageSquare, Plus, Send, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSessions } from "@/hooks/use-sessions";
import {
  sessionsApi,
  type ButtonPayload,
  type ListRow,
  type ListSection,
  type MediaPayload,
} from "@/lib/sessions-api";
import { RecipientImporter, type RecipientRow } from "@/components/RecipientImporter";
import { templatesApi, type Template } from "@/lib/templates-api";
import { audiencesApi, type Audience } from "@/lib/audiences-api";

export const Route = createFileRoute("/_app/send")({ component: SendPage });

const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
const MAX_RECIPIENTS = 250;
const MIN_DELAY_MS = 1500;
type MessageType = "text" | "media" | "buttons" | "list" | "media-buttons" | "media-list";

function mediaType(file: File): MediaPayload["mediatype"] | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("application/") || file.type.startsWith("text/")) return "document";
  return null;
}

async function dataUrlToFile(dataUrl: string, fileName: string, mimeType: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName || "template-media", { type: mimeType || blob.type || "application/octet-stream" });
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

function personalize(value: string, recipient: RecipientRow) {
  return value
    .replaceAll("{{name}}", recipient.name || "")
    .replaceAll("{{company}}", recipient.company || "")
    .replaceAll("{{custom1}}", recipient.custom1 || "")
    .replaceAll("{{custom2}}", recipient.custom2 || "");
}

function SendPage() {
  const { data: sessions = [] } = useSessions();
  const connected = useMemo(
    () =>
      sessions.filter((s: any) =>
        ["open", "connected", "online"].includes(String(s.state || s.status || "").toLowerCase()),
      ),
    [sessions],
  );

  const [instance, setInstance] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [selectedAudience, setSelectedAudience] = useState("");
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [manualRecipient, setManualRecipient] = useState<RecipientRow>({ phone: "", name: "", company: "", custom1: "", custom2: "" });
  const [type, setType] = useState<MessageType>("text");
  const [text, setText] = useState("Hello {{name}},\n\nWe have an offer for {{company}}.");
  const [file, setFile] = useState<File | null>(null);
  const [buttonText, setButtonText] = useState("Choose");
  const [buttons, setButtons] = useState<ButtonPayload[]>([newButton()]);
  const [sections, setSections] = useState<ListSection[]>([newSection()]);
  const [delayMs, setDelayMs] = useState("1500");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [result, setResult] = useState("");
  const isMediaType = ["media", "media-buttons", "media-list"].includes(type);
  const isButtonType = ["buttons", "media-buttons"].includes(type);
  const isListType = ["list", "media-list"].includes(type);
  const previewRecipient = recipients[0] || {
    phone: "919999999999",
    name: "Rahul",
    company: "Acme Ltd",
    custom1: "VIP",
    custom2: "North",
  };
  const previewText = personalize(text, previewRecipient);

  useEffect(() => {
    void templatesApi.list().then(setTemplates).catch(() => setTemplates([]));
    void audiencesApi.list().then(setAudiences).catch(() => setAudiences([]));
  }, []);

  const loadAudience = async (id: string) => {
    setSelectedAudience(id);
    if (!id) return;
    setAudienceLoading(true);
    try {
      const audience = await audiencesApi.get(id);
      const rows = Array.isArray(audience.recipients) ? audience.recipients : [];
      if (rows.length > MAX_RECIPIENTS) {
        toast.error(`Audience has ${rows.length} recipients; Send Message is limited to ${MAX_RECIPIENTS}.`);
      }
      setRecipients(rows.slice(0, MAX_RECIPIENTS).map((row) => ({
        phone: String(row.phone || ""),
        name: String(row.name || ""),
        company: String(row.company || ""),
        custom1: String(row.custom1 || ""),
        custom2: String(row.custom2 || ""),
      })));
      toast.success(`Loaded ${Math.min(rows.length, MAX_RECIPIENTS)} recipients from the saved audience.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load audience");
    } finally {
      setAudienceLoading(false);
    }
  };

  const addRecipient = () => {
    const phone = manualRecipient.phone.replace(/\D/g, "");
    if (!/^\d{8,15}$/.test(phone)) return toast.error("Enter a valid phone number (8–15 digits).");
    if (recipients.some((row) => row.phone === phone)) return toast.error("That recipient is already in the list.");
    if (recipients.length >= MAX_RECIPIENTS) return toast.error(`Maximum ${MAX_RECIPIENTS} recipients are allowed.`);
    setRecipients((rows) => [...rows, { ...manualRecipient, phone }]);
    setManualRecipient({ phone: "", name: "", company: "", custom1: "", custom2: "" });
  };

  const removeRecipient = (phone: string) => {
    setRecipients((rows) => rows.filter((row) => row.phone !== phone));
  };

  const applyTemplate = async (id: string) => {
    setSelectedTemplate(id);
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    const data = template.data && typeof template.data === "object" ? template.data : {};
    setType(template.type);
    setText(String(data.text || data.caption || ""));
    setButtonText(String(data.buttonText || "Choose"));
    try {
      const parsedButtons = typeof data.buttonsJson === "string" ? JSON.parse(data.buttonsJson) : data.buttons;
      if (Array.isArray(parsedButtons) && parsedButtons.length) {
        setButtons(parsedButtons.slice(0, 3).map((button: any, index: number) => ({
          id: String(button.id || index + 1),
          displayText: String(button.displayText || button.text || ""),
        })));
      }
    } catch { setButtons([newButton()]); }
    try {
      const parsedSections = typeof data.sectionsJson === "string" ? JSON.parse(data.sectionsJson) : data.sections;
      if (Array.isArray(parsedSections) && parsedSections.length) setSections(parsedSections);
    } catch { setSections([newSection()]); }
    const media = String(data.mediaBase64 || "");
    if (media) {
      try {
        const restored = await dataUrlToFile(media, String(data.mediaFileName || "template-media"), String(data.mediaMimeType || ""));
        if (restored.size <= MAX_MEDIA_BYTES) setFile(restored);
        else toast.error("The template media is larger than the 8 MB send limit.");
      } catch { toast.error("Could not restore template media."); }
    } else {
      setFile(null);
    }
  };

  const updateSection = (si: number, patch: Partial<ListSection>) =>
    setSections((items) =>
      items.map((item, index) => (index === si ? { ...item, ...patch } : item)),
    );

  const updateRow = (si: number, ri: number, patch: Partial<ListRow>) =>
    setSections((items) =>
      items.map((section, index) =>
        index === si
          ? {
              ...section,
              rows: section.rows.map((row, rowIndex) =>
                rowIndex === ri ? { ...row, ...patch } : row,
              ),
            }
          : section,
      ),
    );

  const send = async () => {
    if (!instance) return toast.error("Select a connected Evolution instance.");
    if (!recipients.length) return toast.error("Import at least one recipient.");
    if (recipients.length > MAX_RECIPIENTS)
      return toast.error(`Maximum ${MAX_RECIPIENTS} recipients are allowed.`);
    if ((type === "text" || isButtonType || isListType) && !text.trim())
      return toast.error("Message text is required.");
    if (isMediaType && !file) return toast.error("Attach a file first.");
    if (file && file.size > MAX_MEDIA_BYTES) return toast.error("Media must be 8 MB or smaller.");

    const mediatype = file ? mediaType(file) : null;
    if (isMediaType && !mediatype) return toast.error("Unsupported media type.");
    if (
      isButtonType &&
      (buttons.filter((b) => b.displayText.trim()).length < 1 ||
        buttons.filter((b) => b.displayText.trim()).length > 3)
    ) {
      return toast.error("Add 1–3 buttons.");
    }

    const validSections = sections
      .map((section) => ({
        title: section.title?.trim(),
        rows: section.rows
          .filter((row) => row.title.trim())
          .map((row, i) => ({
            title: row.title.trim(),
            rowId: row.rowId || String(i + 1),
            description: row.description?.trim(),
          })),
      }))
      .filter((section) => section.rows.length);
    const rowCount = validSections.reduce((count, section) => count + section.rows.length, 0);
    if (isListType && (!text.trim() || !buttonText.trim() || !rowCount || rowCount > 10)) {
      return toast.error("Enter message text, a menu button and 1–10 rows.");
    }

    setBusy(true);
    setResult("");
    setProgress({ sent: 0, failed: 0, total: recipients.length });

    try {
      const base64 = file ? await fileToBase64(file) : "";
      let sent = 0;
      let failed = 0;

      for (let index = 0; index < recipients.length; index += 1) {
        const recipient = recipients[index];
        try {
          const number = recipient.phone;
          if (type === "text") {
            await sessionsApi.sendText(instance, number, personalize(text.trim(), recipient));
          } else if (isMediaType) {
            await sessionsApi.sendMedia(
              instance,
              number,
              {
                base64,
                mediatype: mediatype!,
                mimetype: file!.type || "application/octet-stream",
                fileName: file!.name,
              },
              personalize(text.trim(), recipient),
            );
            if (type === "media-buttons") {
              const validButtons = buttons
                .filter((b) => b.displayText.trim())
                .slice(0, 3)
                .map((button, i) => ({
                  id: button.id || String(i + 1),
                  displayText: personalize(button.displayText.trim(), recipient),
                }));
              await sessionsApi.sendButtons(instance, number, {
                text: personalize(text.trim(), recipient),
                buttons: validButtons,
              });
            } else if (type === "media-list") {
              await sessionsApi.sendList(instance, number, {
                text: personalize(text.trim(), recipient),
                buttonText: personalize(buttonText.trim(), recipient),
                sections: validSections.map((section) => ({
                  title: personalize(section.title || "", recipient),
                  rows: section.rows.map((row) => ({
                    ...row,
                    title: personalize(row.title, recipient),
                    description: personalize(row.description || "", recipient),
                  })),
                })),
              });
            }
          } else if (isButtonType) {
            const validButtons = buttons
              .filter((b) => b.displayText.trim())
              .slice(0, 3)
              .map((button, i) => ({
                id: button.id || String(i + 1),
                displayText: personalize(button.displayText.trim(), recipient),
              }));
            await sessionsApi.sendButtons(instance, number, {
              text: personalize(text.trim(), recipient),
              buttons: validButtons,
            });
          } else {
            await sessionsApi.sendList(instance, number, {
              text: personalize(text.trim(), recipient),
              buttonText: personalize(buttonText.trim(), recipient),
              sections: validSections.map((section) => ({
                title: personalize(section.title || "", recipient),
                rows: section.rows.map((row) => ({
                  ...row,
                  title: personalize(row.title, recipient),
                  description: personalize(row.description || "", recipient),
                })),
              })),
            });
          }
          sent += 1;
        } catch {
          failed += 1;
        }
        setProgress({ sent, failed, total: recipients.length });
        if (index < recipients.length - 1) {
          await new Promise((resolve) =>
            window.setTimeout(resolve, Math.max(MIN_DELAY_MS, Number(delayMs) || MIN_DELAY_MS)),
          );
        }
      }

      setResult(
        failed
          ? `Completed: ${sent} sent, ${failed} failed.`
          : `Successfully sent to all ${sent} recipients.`,
      );
      if (!failed) toast.success(`Sent to ${sent} recipients.`);
      else toast.warning(`${sent} sent, ${failed} failed.`);
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Message sending failed.");
      toast.error(e instanceof Error ? e.message : "Message sending failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            WhatsApp Messaging
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-navy">Send Message</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Import a recipient audience and send personalized WhatsApp messages through a connected
            Evolution instance.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-xs font-medium shadow-sm">
          <span
            className={`size-2 rounded-full ${connected.length ? "bg-emerald-500" : "bg-muted-foreground"}`}
          />
          {connected.length} connected instance{connected.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MessageSquare className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold text-navy">Message setup</h2>
                <p className="text-xs text-muted-foreground">
                  Choose where the message comes from and what to send.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">WhatsApp instance</label>
                <Select value={instance} onValueChange={setInstance}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select connected instance" />
                  </SelectTrigger>
                  <SelectContent>
                    {connected.map((session: any) => (
                      <SelectItem key={session.instanceName} value={session.instanceName}>
                        {session.instanceName}
                        {session.profileName ? ` · ${session.profileName}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Message type</label>
                <Select value={type} onValueChange={(value) => setType(value as MessageType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text message</SelectItem>
                    <SelectItem value="media">Media message</SelectItem>
                    <SelectItem value="buttons">Interactive buttons</SelectItem>
                    <SelectItem value="list">Interactive list</SelectItem>
                    <SelectItem value="media-buttons">Media + buttons</SelectItem>
                    <SelectItem value="media-list">Media + list</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {templates.length > 0 && (
            <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
              <div className="space-y-2">
                <label className="text-sm font-medium">Load saved template</label>
                <Select value={selectedTemplate} onValueChange={(value) => void applyTemplate(value)}>
                  <SelectTrigger><SelectValue placeholder="Select a saved template" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name} · {template.type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Users className="size-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-navy">Recipients</h2>
                  <p className="text-xs text-muted-foreground">
                    Import XLSX, XLS or CSV with phone, name, company and custom fields.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold">
                {recipients.length}/{MAX_RECIPIENTS}
              </span>
            </div>
            <div className="mb-4 grid gap-3 rounded-xl border bg-surface/40 p-4 sm:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <label className="text-sm font-medium">Use saved audience</label>
                <Select value={selectedAudience} onValueChange={(value) => void loadAudience(value)}>
                  <SelectTrigger><SelectValue placeholder="Select a saved audience" /></SelectTrigger>
                  <SelectContent>
                    {audiences.map((audience) => (
                      <SelectItem key={audience.id} value={audience.id}>{audience.name} · {audience.total} recipients</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="outline" disabled={audienceLoading || !selectedAudience} onClick={() => void loadAudience(selectedAudience)}>
                {audienceLoading ? "Loading…" : "Use audience"}
              </Button>
            </div>

            <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <Input placeholder="Phone *" value={manualRecipient.phone} onChange={(e) => setManualRecipient({ ...manualRecipient, phone: e.target.value })} />
              <Input placeholder="Name" value={manualRecipient.name} onChange={(e) => setManualRecipient({ ...manualRecipient, name: e.target.value })} />
              <Input placeholder="Company" value={manualRecipient.company} onChange={(e) => setManualRecipient({ ...manualRecipient, company: e.target.value })} />
              <Input placeholder="Custom 1" value={manualRecipient.custom1} onChange={(e) => setManualRecipient({ ...manualRecipient, custom1: e.target.value })} />
              <Input placeholder="Custom 2" value={manualRecipient.custom2} onChange={(e) => setManualRecipient({ ...manualRecipient, custom2: e.target.value })} />
              <Button type="button" variant="outline" onClick={addRecipient}><Plus className="mr-2 size-4" />Add recipient</Button>
            </div>

            {recipients.length > 0 && (
              <div className="mb-4 overflow-hidden rounded-xl border">
                <div className="max-h-72 overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">#</th><th className="px-3 py-2">Phone</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Company</th><th className="px-3 py-2">Custom 1</th><th className="px-3 py-2">Custom 2</th><th className="px-3 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipients.map((row, index) => (
                        <tr key={`${row.phone}-${index}`} className="border-t">
                          <td className="px-3 py-2 text-muted-foreground">{index + 1}</td>
                          <td className="px-3 py-2 font-medium">{row.phone}</td>
                          <td className="px-3 py-2">{row.name || "—"}</td>
                          <td className="px-3 py-2">{row.company || "—"}</td>
                          <td className="px-3 py-2">{row.custom1 || "—"}</td>
                          <td className="px-3 py-2">{row.custom2 || "—"}</td>
                          <td className="px-3 py-2 text-right"><Button type="button" variant="ghost" size="sm" onClick={() => removeRecipient(row.phone)}>Remove</Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <RecipientImporter value={recipients} onChange={setRecipients} max={MAX_RECIPIENTS} />
          </section>

          <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileUp className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold text-navy">Message content</h2>
                <p className="text-xs text-muted-foreground">
                  Use {"{{name}}"}, {"{{company}}"}, {"{{custom1}}"} and {"{{custom2}}"} for
                  personalization.
                </p>
              </div>
            </div>

            <Textarea
              className={`resize-y ${isMediaType ? "min-h-28" : "min-h-40"}`}
              placeholder={
                isMediaType
                  ? "Write your message or caption..."
                  : "Write your message..."
              }
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            {isMediaType && (
              <div className="mt-3">
                <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface/50 px-4 text-center transition hover:border-primary/50 hover:bg-primary/5">
                  <FileUp className="mb-2 size-7 text-primary" />
                  <span className="text-sm font-medium">
                    {file ? file.name : "Choose image, video or document"}
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    {file
                      ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                      : "Maximum file size: 8 MB"}
                  </span>
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            )}

            {isButtonType && (
              <div className="mt-4 space-y-3 rounded-xl border bg-surface/40 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Buttons</p>
                    <p className="text-xs text-muted-foreground">1–3 quick reply buttons</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={buttons.length >= 3}
                    onClick={() => setButtons([...buttons, newButton()])}
                  >
                    <Plus className="mr-1 size-4" />
                    Add
                  </Button>
                </div>
                {buttons.map((button, index) => (
                  <div className="flex gap-2" key={button.id}>
                    <Input
                      placeholder={`Button ${index + 1} text`}
                      value={button.displayText}
                      onChange={(e) =>
                        setButtons(
                          buttons.map((item) =>
                            item.id === button.id ? { ...item, displayText: e.target.value } : item,
                          ),
                        )
                      }
                    />
                    {buttons.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setButtons(buttons.filter((item) => item.id !== button.id))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {isListType && (
              <div className="mt-4 space-y-4 rounded-xl border bg-surface/40 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">List menu</p>
                    <p className="text-xs text-muted-foreground">Up to 10 rows across sections</p>
                  </div>
                  <Input
                    className="max-w-40"
                    placeholder="Button text"
                    value={buttonText}
                    onChange={(e) => setButtonText(e.target.value)}
                  />
                </div>
                {sections.map((section, si) => (
                  <div className="space-y-2 rounded-lg border bg-white p-3" key={si}>
                    <div className="flex gap-2">
                      <Input
                        placeholder={`Section ${si + 1} title`}
                        value={section.title || ""}
                        onChange={(e) => updateSection(si, { title: e.target.value })}
                      />
                      {sections.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setSections(sections.filter((_, index) => index !== si))}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                    {section.rows.map((row, ri) => (
                      <div className="space-y-2 rounded-md border p-2" key={row.rowId}>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Row title"
                            value={row.title}
                            onChange={(e) => updateRow(si, ri, { title: e.target.value })}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              updateSection(si, {
                                rows: section.rows.filter((_, index) => index !== ri),
                              })
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        <Input
                          placeholder="Row description (optional)"
                          value={row.description || ""}
                          onChange={(e) => updateRow(si, ri, { description: e.target.value })}
                        />
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updateSection(si, { rows: [...section.rows, newRow()] })}
                    >
                      <Plus className="mr-1 size-4" />
                      Row
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSections([...sections, newSection()])}
                >
                  <Plus className="mr-1 size-4" />
                  Section
                </Button>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-navy">Live preview</h2>
                <p className="text-xs text-muted-foreground">
                  Preview using the first recipient's personalization data.
                </p>
              </div>
              <MessageSquare className="size-5 text-primary" />
            </div>
            <div className="mt-4 flex justify-end rounded-xl bg-[#efeae2] p-4">
              <div className="w-full max-w-[300px] rounded-xl bg-white p-3 shadow-sm">
                {isMediaType && file && (
                  <div className="mb-3 overflow-hidden rounded-lg bg-surface p-2 text-center text-xs text-muted-foreground">
                    {file.type.startsWith("image/") ? (
                      <div className="flex max-h-44 items-center justify-center overflow-hidden rounded-md bg-surface">
                        <img
                          src={URL.createObjectURL(file)}
                          alt="Media preview"
                          className="max-h-44 w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="py-8">
                        <FileUp className="mx-auto mb-2 size-6 text-primary" />
                        {file.name}
                      </div>
                    )}
                  </div>
                )}
                {isButtonType || isListType ? (
                  <>
                    <p className="whitespace-pre-wrap text-sm">
                      {previewText || "Your message preview will appear here."}
                    </p>
                    {isButtonType ? (
                      <div className="mt-3 space-y-1">
                        {buttons
                          .filter((b) => b.displayText.trim())
                          .slice(0, 3)
                          .map((b) => (
                            <div
                              key={b.id}
                              className="rounded-md border border-primary/20 py-2 text-center text-sm font-medium text-primary"
                            >
                              {personalize(b.displayText, previewRecipient)}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="mt-3 space-y-1">
                        {sections
                          .flatMap((s) => s.rows)
                          .filter((r) => r.title.trim())
                          .slice(0, 10)
                          .map((r) => (
                            <div key={r.rowId} className="rounded-md border p-2">
                              <p className="text-sm font-medium">
                                {personalize(r.title, previewRecipient)}
                              </p>
                              {r.description && (
                                <p className="text-xs text-muted-foreground">
                                  {personalize(r.description, previewRecipient)}
                                </p>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                    {isListType && (
                      <div className="mt-2 rounded-md bg-surface py-2 text-center text-xs font-medium">
                        {personalize(buttonText, previewRecipient)}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="whitespace-pre-wrap text-sm">
                    {previewText || "Your message preview will appear here."}
                  </p>
                )}
                <p className="mt-1 text-right text-[10px] text-muted-foreground">now</p>
              </div>
            </div>
            </section>
          <section className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-navy">Send controls</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Messages are sent sequentially to protect your WhatsApp instance. Media + interactive
              sends the media first, followed by the interactive message because Evolution exposes
              media and interactive messages as separate endpoints.
            </p>
            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium">Delay between recipients</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={MIN_DELAY_MS}
                  max={10000}
                  step={100}
                  value={delayMs}
                  onChange={(e) => setDelayMs(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">ms</span>
              </div>
              <p className="text-xs text-muted-foreground">Minimum {MIN_DELAY_MS} ms.</p>
            </div>
            <Button
              className="mt-5 w-full"
              size="lg"
              disabled={busy || !instance || !recipients.length}
              onClick={() => void send()}
            >
              <Send className="mr-2 size-4" />
              {busy
                ? `Sending ${progress.sent + progress.failed}/${progress.total}…`
                : `Send to ${recipients.length || 0} recipients`}
            </Button>
            {busy && (
              <div className="mt-4 space-y-2">
                <div className="h-2 overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${progress.total ? ((progress.sent + progress.failed) / progress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{progress.sent} sent</span>
                  <span>{progress.failed} failed</span>
                </div>
              </div>
            )}
            {result && (
              <div className="mt-4 flex gap-2 rounded-lg border bg-surface p-3 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{result}</span>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-navy p-5 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
              Personalization
            </p>
            <h3 className="mt-1 font-semibold">Make every message personal</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {["{{name}}", "{{company}}", "{{custom1}}", "{{custom2}}"].map((token) => (
                <code key={token} className="rounded-md bg-white/10 px-2 py-2 text-white/80">
                  {token}
                </code>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}