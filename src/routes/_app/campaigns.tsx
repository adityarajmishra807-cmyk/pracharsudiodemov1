import { createFileRoute } from "@tanstack/react-router";
import { Lock, Megaphone, Pause, Play, Plus, RefreshCw, RotateCcw, Square, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate, useStore } from "@/lib/store";
import { campaignsApi, type Campaign } from "@/lib/campaigns-api";
import { audiencesApi, type Audience } from "@/lib/audiences-api";
import { sessionsApi, type Session } from "@/lib/sessions-api";
import { RecipientImporter, type RecipientRow } from "@/components/RecipientImporter";
import { templatesApi, type Template } from "@/lib/templates-api";

export const Route = createFileRoute("/_app/campaigns")({
  head: () => ({ meta: [{ title: "Campaigns — Prachar Studio" }, { name: "description", content: "Persistent WhatsApp campaign manager." }] }),
  component: CampaignsPage,
});

type CampaignType = "text" | "media" | "media-text" | "buttons" | "list" | "media-buttons" | "media-list";
type ButtonDraft = { id: string; displayText: string; type: "quickReply" | "url" | "phone" | "copy"; url?: string; phoneNumber?: string; copyCode?: string };
type RowDraft = { rowId: string; title: string; description: string };
type SectionDraft = { title: string; rows: RowDraft[] };

const emptyButton = (): ButtonDraft => ({ id: "", displayText: "", type: "quickReply" });
const emptyRow = (): RowDraft => ({ rowId: "", title: "", description: "" });
const emptySection = (): SectionDraft => ({ title: "", rows: [emptyRow()] });

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error || new Error("Could not read media."));
    reader.readAsDataURL(file);
  });
}

function CampaignsPage() {
  const { can } = useStore();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [audienceId, setAudienceId] = useState("");
  const [audienceBusy, setAudienceBusy] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [instance, setInstance] = useState("");
  const [type, setType] = useState<CampaignType>("text");
  const [recipientRows, setRecipientRows] = useState<RecipientRow[]>([]);
  const [delayMs, setDelayMs] = useState("1500");
  const [text, setText] = useState("Hello {{name}}, we have an offer for {{company}}.");
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<Record<string, string> | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [footer, setFooter] = useState("");
  const [buttonText, setButtonText] = useState("View options");
  const [buttons, setButtons] = useState<ButtonDraft[]>([emptyButton()]);
  const [sections, setSections] = useState<SectionDraft[]>([emptySection()]);

  const load = async () => {
    try {
      const [items, available, savedAudiences, savedTemplates] = await Promise.all([campaignsApi.list(), sessionsApi.list(), audiencesApi.list(), templatesApi.list()]);
      setCampaigns(items);
      setSessions(available);
      setAudiences(savedAudiences);
      setTemplates(savedTemplates);
      if (!instance && available.length) setInstance(available[0].instanceName || "");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not load campaign data"); }
  };
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const connected = useMemo(() => sessions.filter((s) => ["open", "connected", "online"].includes(String(s.state || s.status || "").toLowerCase())), [sessions]);
  const requiresMedia = ["media", "media-text", "media-buttons", "media-list"].includes(type);
  const requiresButtons = ["buttons", "media-buttons"].includes(type);
  const requiresList = ["list", "media-list"].includes(type);

  const resetComposer = () => {
    setName(""); setRecipientRows([]); setAudienceId(""); setTemplateId(""); setType("text"); setText("Hello {{name}}, we have an offer for {{company}}.");
    setCaption(""); setMedia(null); setTitle(""); setDescription(""); setFooter(""); setButtonText("View options");
    setButtons([emptyButton()]); setSections([emptySection()]);
  };

  const updateButton = (index: number, patch: Partial<ButtonDraft>) =>
    setButtons((items) => items.map((item, i) => i === index ? { ...item, ...patch } : item));
  const updateRow = (sectionIndex: number, rowIndex: number, patch: Partial<RowDraft>) =>
    setSections((items) => items.map((s, i) => i === sectionIndex ? { ...s, rows: s.rows.map((r, j) => j === rowIndex ? { ...r, ...patch } : r) } : s));

  const selectAudience = async (id: string) => {
    setAudienceId(id);
    if (!id) {
      setRecipientRows([]);
      return;
    }
    setAudienceBusy(true);
    try {
      const audience = await audiencesApi.get(id);
      if (audience.total > 250) {
        setRecipientRows([]);
        toast.error(`This audience contains ${audience.total} recipients. Campaigns currently support up to 250.`);
        return;
      }
      setRecipientRows(audience.recipients as RecipientRow[]);
      toast.success(`Loaded ${audience.total} recipients from ${audience.name}.`);
    } catch (e) {
      setRecipientRows([]);
      toast.error(e instanceof Error ? e.message : "Could not load audience.");
    } finally {
      setAudienceBusy(false);
    }
  };

  const selectTemplate = async (id: string) => {
    setTemplateId(id);
    if (!id) return;
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    setTemplateBusy(true);
    try {
      const data = template.data || {};
      const nextType = template.type as CampaignType;
      setType(nextType);
      setName((current) => current.trim() ? current : template.name);
      if (nextType === "text") setText(String(data.text || ""));
      if (nextType === "media-text") {
        setCaption(String(data.caption || ""));
        if (data.media && typeof data.media === "object") setMedia(data.media as Record<string, string>);
      }
      if (["media", "media-buttons", "media-list"].includes(nextType) && data.media && typeof data.media === "object") {
        setMedia(data.media as Record<string, string>);
      }
      if (["buttons", "media-buttons"].includes(nextType)) {
        setTitle(String(data.title || ""));
        setDescription(String(data.description || ""));
        setFooter(String(data.footer || ""));
        const parsed = Array.isArray(data.buttons) ? data.buttons : (() => {
          try { return JSON.parse(String(data.buttonsJson || "[]")); } catch { return []; }
        })();
        if (Array.isArray(parsed) && parsed.length) setButtons(parsed.map((b: Record<string, unknown>) => ({
          id: String(b.id || ""), displayText: String(b.displayText || ""), type: b.url ? "url" : b.phoneNumber ? "phone" : b.copyCode ? "copy" : "quickReply",
          ...(b.url ? { url: String(b.url) } : {}), ...(b.phoneNumber ? { phoneNumber: String(b.phoneNumber) } : {}), ...(b.copyCode ? { copyCode: String(b.copyCode) } : {}),
        })));
      }
      if (["list", "media-list"].includes(nextType)) {
        setTitle(String(data.title || ""));
        setDescription(String(data.description || ""));
        setFooter(String(data.footerText || data.footer || ""));
        setButtonText(String(data.buttonText || "View options"));
        const parsed = Array.isArray(data.sections) ? data.sections : (() => {
          try { return JSON.parse(String(data.sectionsJson || "[]")); } catch { return []; }
        })();
        if (Array.isArray(parsed) && parsed.length) setSections(parsed.map((s: Record<string, unknown>) => ({
          title: String(s.title || ""), rows: Array.isArray(s.rows) ? s.rows.map((row: Record<string, unknown>) => ({ rowId: String(row.rowId || ""), title: String(row.title || ""), description: String(row.description || "") })) : [emptyRow()],
        })));
      }
      toast.success(`Loaded template: ${template.name}`);
    } finally {
      setTemplateBusy(false);
    }
  };

  const create = async () => {
    const list = recipientRows;
    if (!name.trim()) return toast.error("Campaign name is required.");
    if (!instance) return toast.error("Select a connected Evolution instance.");
    if (!list.length) return toast.error("Add at least one recipient.");
    if (list.length > 250) return toast.error("Maximum 250 recipients per campaign.");
    if (requiresMedia && !media) return toast.error("Media is required.");
    if ((type === "text" || type === "media-text") && !text.trim() && !caption.trim()) return toast.error("Message text is required.");
    if (requiresButtons && (!title.trim() || !buttons.length || buttons.length > 3 || buttons.some((b) => !b.id.trim() || !b.displayText.trim()))) return toast.error("Add a title and 1–3 valid buttons.");
    const rowCount = sections.reduce((n, s) => n + s.rows.length, 0);
    if (requiresList && (!title.trim() || !buttonText.trim() || !rowCount || rowCount > 10 || sections.some((s) => s.rows.some((r) => !r.rowId.trim() || !r.title.trim())))) return toast.error("Add a list title, menu button and 1–10 valid rows.");
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {};
      if (type === "text") payload.text = text.trim();
      if (type === "media-text") { payload.media = media; payload.caption = caption.trim() || text.trim(); }
      if (type === "media") { payload.media = media; payload.caption = caption.trim(); }
      if (requiresButtons) {
        payload.title = title.trim(); payload.description = description.trim(); payload.footer = footer.trim();
        payload.buttons = buttons.map(({ type: buttonType, ...b }) => ({ ...b, ...(buttonType === "url" ? { url: b.url } : {}), ...(buttonType === "phone" ? { phoneNumber: b.phoneNumber } : {}), ...(buttonType === "copy" ? { copyCode: b.copyCode } : {}) }));
      }
      if (requiresList) {
        payload.title = title.trim(); payload.description = description.trim(); payload.footerText = footer.trim(); payload.buttonText = buttonText.trim();
        payload.sections = sections.map((s) => ({ title: s.title.trim(), rows: s.rows.map((r) => ({ rowId: r.rowId.trim(), title: r.title.trim(), description: r.description.trim() })) }));
      }
      if (type === "media-buttons" || type === "media-list") payload.media = media;
      await campaignsApi.create({
        name: name.trim(),
        type,
        instance,
        ...(audienceId ? { audienceId } : { recipients: list }),
        delayMs: Math.max(1500, Math.min(10000, Number(delayMs) || 1500)),
        payload,
      });
      toast.success("Campaign queued.");
      setOpen(false); resetComposer(); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Campaign creation failed"); }
    finally { setBusy(false); }
  };

  const showDetails = async (id: string) => {
    setDetailsBusy(true);
    setDetailsOpen(true);
    try {
      setSelectedCampaign(await campaignsApi.get(id));
    } catch (e) {
      setDetailsOpen(false);
      toast.error(e instanceof Error ? e.message : "Could not load campaign details.");
    } finally {
      setDetailsBusy(false);
    }
  };

  const action = async (id: string, fn: (id: string) => Promise<Campaign>, message: string) => {
    try { await fn(id); toast.success(message); await load(); } catch (e) { toast.error(e instanceof Error ? e.message : "Action failed"); }
  };

  if (!can("campaigns")) return <div className="space-y-5"><PageHeader title="Campaigns" /><EmptyState icon={Lock} title="No campaign access" description="Ask the workspace owner to enable campaigns for your account." /></div>;

  return <div className="space-y-5">
    <PageHeader title="Campaigns" description="Persistent WhatsApp campaigns backed by the Evolution worker." actions={<Button onClick={() => setOpen(true)}><Plus className="size-4" /> New campaign</Button>} />
    {!campaigns.length ? <EmptyState icon={Megaphone} title="No campaigns yet" description="Create a persistent campaign and the background worker will process it." action={<Button onClick={() => setOpen(true)}>Create campaign</Button>} /> :
      <ul className="grid gap-3 lg:grid-cols-2">{campaigns.map((c) => <li key={c.id} className="rounded-lg border border-border bg-card p-4">
        <div className="flex justify-between gap-3"><div><p className="font-semibold text-navy">{c.name}</p><p className="text-xs text-muted-foreground">{c.type} · {c.instance} · {formatDate(c.createdAt)}</p></div><StatusBadge value={c.status} /></div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-sm"><div><span className="text-xs text-muted-foreground">Total</span><p>{c.total}</p></div><div><span className="text-xs text-muted-foreground">Sent</span><p>{c.sent}</p></div><div><span className="text-xs text-muted-foreground">Failed</span><p>{c.failed}</p></div><div><span className="text-xs text-muted-foreground">Remaining</span><p>{Math.max(0, c.total - c.sent - c.failed)}</p></div></div>
        {c.error && <p className="mt-2 text-sm text-destructive">{c.error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {["queued", "running"].includes(c.status) && <Button size="sm" variant="outline" onClick={() => void action(c.id, campaignsApi.pause, "Paused")}><Pause className="size-3.5" /> Pause</Button>}
          {c.status === "paused" && <Button size="sm" onClick={() => void action(c.id, campaignsApi.resume, "Resumed")}><Play className="size-3.5" /> Resume</Button>}
          {["queued", "running", "paused"].includes(c.status) && <Button size="sm" variant="outline" onClick={() => void action(c.id, campaignsApi.cancel, "Cancelled")}><Square className="size-3.5" /> Cancel</Button>}
          {c.failed > 0 && <Button size="sm" variant="outline" onClick={() => void action(c.id, campaignsApi.retryFailed, "Retry queued")}><RotateCcw className="size-3.5" /> Retry failed</Button>}
          <Button size="sm" variant="outline" onClick={() => void showDetails(c.id)}>Delivery details</Button>
          <Button size="sm" variant="ghost" onClick={() => void load()}><RefreshCw className="size-3.5" /></Button>
        </div>
      </li>)}</ul>}

    <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Delivery details{selectedCampaign ? ` — ${selectedCampaign.name}` : ""}</DialogTitle>
          <DialogDescription>Recipient-level send and Evolution delivery status tracking.</DialogDescription>
        </DialogHeader>
        {detailsBusy || !selectedCampaign ? <div className="py-10 text-center text-sm text-muted-foreground">Loading delivery details…</div> :
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[["Total",selectedCampaign.total],["Sent",selectedCampaign.sent],["Failed",selectedCampaign.failed],["Remaining",Math.max(0,selectedCampaign.total-selectedCampaign.sent-selectedCampaign.failed)],["Status",selectedCampaign.status]].map(([label,value]) =>
                <div key={String(label)} className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>
              )}
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                  <th className="p-3">#</th><th className="p-3">Recipient</th><th className="p-3">Result</th><th className="p-3">Evolution message</th><th className="p-3">Latest status</th><th className="p-3">Updated</th>
                </tr></thead>
                <tbody>
                  {selectedCampaign.recipients.map((recipient, index) => {
                    const result = selectedCampaign.results.find((item) => item.index === index);
                    const statuses = result?.deliveryStatuses || [];
                    const latest = statuses.length ? statuses[statuses.length - 1] as Record<string, unknown> : null;
                    const status = String(latest?.status || (result?.ok ? "SENT" : "ERROR"));
                    const messageId = String(latest?.messageId || "—");
                    const updatedAt = latest?.updatedAt ? formatDate(String(latest.updatedAt)) : result?.timestamp ? formatDate(result.timestamp) : "—";
                    return <tr key={index} className="border-b last:border-0">
                      <td className="p-3">{index + 1}</td>
                      <td className="p-3 font-medium">{recipient.phone || "—"}{recipient.name ? <div className="text-xs text-muted-foreground">{recipient.name}</div> : null}</td>
                      <td className="p-3"><span className={result?.ok ? "text-foreground" : "text-destructive"}>{result?.ok ? "Sent" : "Failed"}</span>{result?.message ? <div className="max-w-xs text-xs text-destructive">{result.message}</div> : null}</td>
                      <td className="p-3"><code className="text-xs">{messageId}</code></td>
                      <td className="p-3"><StatusBadge value={status} /></td>
                      <td className="p-3 text-xs text-muted-foreground">{updatedAt}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
              {!selectedCampaign.recipients.length && <p className="p-6 text-center text-sm text-muted-foreground">No recipients.</p>}
            </div>
            <p className="text-xs text-muted-foreground">Evolution statuses tracked: ERROR, PENDING, SERVER_ACK, DELIVERY_ACK, READ, DELETED and PLAYED.</p>
          </div>}
        <DialogFooter><Button variant="outline" onClick={() => setDetailsOpen(false)}>Close</Button>{selectedCampaign && <Button onClick={() => void showDetails(selectedCampaign.id)} disabled={detailsBusy}><RefreshCw className="size-4" /> Refresh</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>New WhatsApp campaign</DialogTitle><DialogDescription>Build the exact Evolution message payload and queue it for background delivery.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Campaign name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer offer" /></div>
            <div><Label>Evolution instance</Label><Select value={instance} onValueChange={setInstance}><SelectTrigger><SelectValue placeholder="Select instance" /></SelectTrigger><SelectContent>{connected.map((s) => <SelectItem key={s.instanceName} value={s.instanceName || ""}>{s.instanceName}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={templateId || "__none__"} onValueChange={(value) => void selectTemplate(value === "__none__" ? "" : value)}>
              <SelectTrigger><SelectValue placeholder="Start from a saved template" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No template</SelectItem>
                {templates.filter((t) => t.status !== "paused").map((t) => <SelectItem key={t.id} value={t.id}>{t.name} · {t.type}</SelectItem>)}
              </SelectContent>
            </Select>
            {templateBusy && <p className="text-xs text-muted-foreground">Loading template…</p>}
          </div>
          <div><Label>Message type</Label><Select value={type} onValueChange={(v) => setType(v as CampaignType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["text","media","media-text","buttons","list","media-buttons","media-list"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-3">
            <Label>Recipients</Label>
            <div className="rounded-md border p-3 space-y-3">
              <div>
                <Label>Saved audience</Label>
                <Select value={audienceId || "__manual__"} onValueChange={(value) => void selectAudience(value === "__manual__" ? "" : value)}>
                  <SelectTrigger><SelectValue placeholder="Import recipients manually" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__manual__">Manual import</SelectItem>
                    {audiences.map((audience) => (
                      <SelectItem key={audience.id} value={audience.id}>
                        {audience.name} · {audience.total} recipients
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {audienceBusy && <p className="mt-1 text-xs text-muted-foreground">Loading audience…</p>}
                {audienceId && !audienceBusy && <p className="mt-1 text-xs text-muted-foreground">Recipients are snapshotted into this campaign when it is queued.</p>}
              </div>
              {!audienceId && <RecipientImporter value={recipientRows} onChange={setRecipientRows} max={250} />}
              {audienceId && !!recipientRows.length && <p className="text-sm text-muted-foreground">{recipientRows.length} recipients loaded from the selected audience.</p>}
            </div>
          </div>

          {type === "text" && <div><Label>Message</Label><Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Hello {{name}}" /></div>}

          {requiresMedia && <div className="space-y-2"><Label>Media (maximum 8 MB)</Label><Input type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 8 * 1024 * 1024) { e.target.value = ""; return toast.error("Media must be 8 MB or smaller."); } try { const base64 = await fileToBase64(file); setMedia({ base64, mediatype: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "document", mimetype: file.type || "application/octet-stream", fileName: file.name }); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not read media."); } }} /><p className="text-xs text-muted-foreground">{media ? `Selected: ${media.fileName}` : "Choose an image, video or document."}</p></div>}

          {["media", "media-text"].includes(type) && <div><Label>{type === "media-text" ? "Caption" : "Optional caption"}</Label><Textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Hello {{name}}" /></div>}

          {requiresButtons && <div className="space-y-3 rounded-md border p-3">
            <div className="grid gap-3 sm:grid-cols-2"><div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div><div><Label>Footer</Label><Input value={footer} onChange={(e) => setFooter(e.target.value)} /></div></div>
            <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            {buttons.map((b, i) => <div key={i} className="grid gap-2 rounded border p-2 sm:grid-cols-5"><Input placeholder="ID" value={b.id} onChange={(e) => updateButton(i, { id: e.target.value })} /><Input placeholder="Button text" value={b.displayText} onChange={(e) => updateButton(i, { displayText: e.target.value })} /><Select value={b.type} onValueChange={(v) => updateButton(i, { type: v as ButtonDraft["type"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="quickReply">Quick reply</SelectItem><SelectItem value="url">URL</SelectItem><SelectItem value="phone">Phone</SelectItem><SelectItem value="copy">Copy code</SelectItem></SelectContent></Select>{b.type === "url" ? <Input placeholder="https://..." value={b.url || ""} onChange={(e) => updateButton(i, { url: e.target.value })} /> : b.type === "phone" ? <Input placeholder="919999999999" value={b.phoneNumber || ""} onChange={(e) => updateButton(i, { phoneNumber: e.target.value })} /> : b.type === "copy" ? <Input placeholder="{{custom1}}" value={b.copyCode || ""} onChange={(e) => updateButton(i, { copyCode: e.target.value })} /> : <div />}<Button type="button" variant="ghost" size="icon" onClick={() => setButtons((items) => items.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button></div>)}
            <Button type="button" variant="outline" disabled={buttons.length >= 3} onClick={() => setButtons((items) => [...items, emptyButton()])}>Add button</Button>
          </div>}

          {requiresList && <div className="space-y-3 rounded-md border p-3">
            <div className="grid gap-3 sm:grid-cols-2"><div><Label>List title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div><div><Label>Menu button</Label><Input value={buttonText} onChange={(e) => setButtonText(e.target.value)} /></div></div>
            <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div><div><Label>Footer</Label><Input value={footer} onChange={(e) => setFooter(e.target.value)} /></div>
            {sections.map((s, si) => <div key={si} className="space-y-2 rounded border p-2"><div className="flex gap-2"><Input placeholder="Section title" value={s.title} onChange={(e) => setSections((items) => items.map((x, i) => i === si ? { ...x, title: e.target.value } : x))} /><Button type="button" variant="ghost" size="icon" onClick={() => setSections((items) => items.filter((_, i) => i !== si))}><Trash2 className="size-4" /></Button></div>{s.rows.map((r, ri) => <div key={ri} className="grid gap-2 sm:grid-cols-4"><Input placeholder="Row ID" value={r.rowId} onChange={(e) => updateRow(si, ri, { rowId: e.target.value })} /><Input placeholder="Title" value={r.title} onChange={(e) => updateRow(si, ri, { title: e.target.value })} /><Input placeholder="Description" value={r.description} onChange={(e) => updateRow(si, ri, { description: e.target.value })} /><Button type="button" variant="ghost" size="icon" onClick={() => setSections((items) => items.map((x, i) => i === si ? { ...x, rows: x.rows.filter((_, j) => j !== ri) } : x))}><Trash2 className="size-4" /></Button></div>)}<Button type="button" variant="outline" onClick={() => setSections((items) => items.map((x, i) => i === si ? { ...x, rows: [...x.rows, emptyRow()] } : x))} disabled={sections.reduce((n, x) => n + x.rows.length, 0) >= 10}>Add row</Button></div>)}
            <Button type="button" variant="outline" onClick={() => setSections((items) => [...items, emptySection()])}>Add section</Button>
          </div>}

          <div><Label>Delay between recipients (ms)</Label><Input type="number" min={1500} max={10000} value={delayMs} onChange={(e) => setDelayMs(e.target.value)} /><p className="mt-1 text-xs text-muted-foreground">Safety minimum: 1500 ms.</p></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy} onClick={() => void create()}>{busy ? "Creating…" : "Create & queue"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
