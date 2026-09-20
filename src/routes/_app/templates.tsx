import { createFileRoute } from "@tanstack/react-router";
import { FileText, Lock, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import { templatesApi, type Template } from "@/lib/templates-api";

export const Route = createFileRoute("/_app/templates")({
  head: () => ({ meta: [{ title: "Templates — Prachar Studio" }] }),
  component: TemplatesPage,
});

const categories = ["Marketing", "Utility", "Support", "Follow-up"];
const types = ["text", "media", "media-text", "buttons", "list", "media-buttons", "media-list"] as const;
type TemplateType = typeof types[number];
type ButtonType = "reply" | "url" | "phone" | "copy_code";
type TemplateButton = { type: ButtonType; id: string; displayText: string; url?: string; phoneNumber?: string; copyCode?: string };
type TemplateRow = { rowId: string; title: string; description?: string };
type TemplateSection = { title?: string; rows: TemplateRow[] };

type Draft = {
  name: string;
  category: string;
  status: "draft" | "approved" | "paused";
  type: TemplateType;
  data: Record<string, unknown>;
};

const defaultButtons = (): TemplateButton[] => [
  { type: "reply", id: "offer", displayText: "View offer" },
];

const defaultSections = (): TemplateSection[] => [
  { title: "Options", rows: [{ rowId: "1", title: "Option 1", description: "" }] },
];

const emptyDraft = (): Draft => ({
  name: "",
  category: "Marketing",
  status: "draft",
  type: "text",
  data: { text: "Hi {{name}}, " },
});

function parseButtons(value: unknown): TemplateButton[] {
  try {
    const parsed = JSON.parse(String(value || ""));
    if (!Array.isArray(parsed)) return defaultButtons();
    return parsed.map((button) => ({
      type: ["reply", "url", "phone", "copy_code"].includes(String(button?.type)) ? button.type : "reply",
      id: String(button?.id || ""),
      displayText: String(button?.displayText || ""),
      ...(button?.url ? { url: String(button.url) } : {}),
      ...(button?.phoneNumber ? { phoneNumber: String(button.phoneNumber) } : {}),
      ...(button?.copyCode ? { copyCode: String(button.copyCode) } : {}),
    }));
  } catch {
    return defaultButtons();
  }
}

function parseSections(value: unknown): TemplateSection[] {
  try {
    const parsed = JSON.parse(String(value || ""));
    if (!Array.isArray(parsed)) return defaultSections();
    return parsed.map((section) => ({
      title: String(section?.title || ""),
      rows: Array.isArray(section?.rows)
        ? section.rows.map((row) => ({
            rowId: String(row?.rowId || ""),
            title: String(row?.title || ""),
            description: row?.description ? String(row.description) : "",
          }))
        : [],
    }));
  } catch {
    return defaultSections();
  }
}

function TemplatesPage() {
  const { can } = useStore();
  const [items, setItems] = useState<Template[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  const canUse = can("templatesUse") || can("templatesManage");
  const canManage = can("templatesManage");

  const load = async () => {
    try { setItems(await templatesApi.list()); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not load templates."); }
  };
  useEffect(() => { void load(); }, []);

  if (!canUse) return <div className="space-y-5"><PageHeader title="Templates" /><EmptyState icon={Lock} title="No template access" description="Ask the workspace owner to enable template access for your account." /></div>;

  const startCreate = () => { setEditingId(null); setDraft(emptyDraft()); setOpen(true); };
  const startEdit = (t: Template) => {
    setEditingId(t.id);
    setDraft({
      name: t.name,
      category: t.category || String(t.data.category || "Marketing"),
      status: t.status || "draft",
      type: t.type,
      data: { ...t.data },
    });
    setOpen(true);
  };
  const updateData = (key: string, value: unknown) => setDraft((d) => ({ ...d, data: { ...d.data, [key]: value } }));

  const setButtons = (buttons: TemplateButton[]) => updateData("buttonsJson", JSON.stringify(buttons));
  const setSections = (sections: TemplateSection[]) => updateData("sectionsJson", JSON.stringify(sections));

  const handleMedia = (file?: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Media must be 8MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateData("mediaBase64", String(reader.result || ""));
      updateData("mediaFileName", file.name);
      updateData("mediaMimeType", file.type || "application/octet-stream");
    };
    reader.onerror = () => toast.error("Could not read media file.");
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!draft.name.trim()) return toast.error("Template name is required.");
    const needsMessage = ["text", "media-text", "buttons", "list", "media-buttons", "media-list"].includes(draft.type);
    const text = String(draft.data.text || draft.data.caption || "").trim();
    if (needsMessage && !text) return toast.error("Message text is required.");
    if (["media", "media-text", "media-buttons", "media-list"].includes(draft.type) && !draft.data.mediaBase64) {
      return toast.error("Media is required for this template type.");
    }
    try {
      const payload = { name: draft.name.trim(), type: draft.type, category: draft.category, status: draft.status, data: draft.data };
      if (editingId) await templatesApi.update(editingId, payload); else await templatesApi.create(payload);
      toast.success(editingId ? "Template updated." : "Template created.");
      setOpen(false); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save template."); }
  };

  const remove = async (id: string) => {
    try { await templatesApi.remove(id); toast.success("Template deleted."); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete template."); }
  };

  const preview = (t: Template) => String(t.data.text || t.data.caption || "Interactive template");

  const renderEditor = () => {
    const isMedia = ["media", "media-text", "media-buttons", "media-list"].includes(draft.type);
    const isButtons = ["buttons", "media-buttons"].includes(draft.type);
    const isList = ["list", "media-list"].includes(draft.type);

    return <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label>Name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
        <div><Label>Type</Label><Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as TemplateType, data: {} })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{types.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label>Category</Label><Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Status</Label><Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as Draft["status"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["draft", "approved", "paused"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
      </div>

      {draft.type === "text" && <div>
        <Label>Message</Label>
        <Textarea rows={7} value={String(draft.data.text || "")} onChange={(e) => updateData("text", e.target.value)} />
        <p className="mt-1 text-xs text-muted-foreground">Variables: {"{{name}}"}, {"{{company}}"}, {"{{custom1}}"}, {"{{custom2}}"}</p>
      </div>}

      {isMedia && <div className="space-y-3 rounded-xl border border-border p-3">
        <div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Media</p><p className="text-xs text-muted-foreground">Image, video or document · max 8MB</p></div><Upload className="size-4 text-muted-foreground" /></div>
        <input className="block w-full text-sm" type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={(e) => handleMedia(e.target.files?.[0])} />
        {draft.data.mediaFileName && <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-sm"><span className="truncate">{String(draft.data.mediaFileName)}</span><Button type="button" size="sm" variant="ghost" onClick={() => { updateData("mediaBase64", ""); updateData("mediaFileName", ""); updateData("mediaMimeType", ""); }}><X className="size-4" /></Button></div>}
        {draft.type === "media" && <div><Label>Caption</Label><Textarea rows={4} value={String(draft.data.text || draft.data.caption || "")} onChange={(e) => updateData("text", e.target.value)} /></div>}
        {draft.type !== "media" && <div><Label>Message</Label><Textarea rows={4} value={String(draft.data.text || "")} onChange={(e) => updateData("text", e.target.value)} /></div>}
      </div>}

      {isButtons && <div className="space-y-3 rounded-xl border border-border p-3">
        <div><p className="text-sm font-semibold">Buttons</p><p className="text-xs text-muted-foreground">Add up to 3 interactive buttons.</p></div>
        <div><Label>Message</Label><Textarea rows={4} value={String(draft.data.text || "")} onChange={(e) => updateData("text", e.target.value)} /></div>
        <div className="space-y-2">
          {parseButtons(draft.data.buttonsJson).slice(0, 3).map((button, index, buttons) => <div key={index} className="rounded-lg border border-border bg-surface/50 p-3">
            <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide">Button {index + 1}</p><Button size="sm" variant="ghost" onClick={() => setButtons(buttons.filter((_, i) => i !== index))}><Trash2 className="size-4" /></Button></div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Select value={button.type} onValueChange={(v) => { const next = [...buttons]; next[index] = { ...button, type: v as ButtonType }; setButtons(next); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="reply">Reply</SelectItem><SelectItem value="url">URL</SelectItem><SelectItem value="phone">Phone</SelectItem><SelectItem value="copy_code">Copy code</SelectItem></SelectContent></Select>
              <Input placeholder="Button ID" value={button.id} onChange={(e) => { const next = [...buttons]; next[index] = { ...button, id: e.target.value }; setButtons(next); }} />
            </div>
            <Input className="mt-2" placeholder="Button text" value={button.displayText} onChange={(e) => { const next = [...buttons]; next[index] = { ...button, displayText: e.target.value }; setButtons(next); }} />
            {button.type === "url" && <Input className="mt-2" placeholder="https://example.com" value={button.url || ""} onChange={(e) => { const next = [...buttons]; next[index] = { ...button, url: e.target.value }; setButtons(next); }} />}
            {button.type === "phone" && <Input className="mt-2" placeholder="+919999999999" value={button.phoneNumber || ""} onChange={(e) => { const next = [...buttons]; next[index] = { ...button, phoneNumber: e.target.value }; setButtons(next); }} />}
            {button.type === "copy_code" && <Input className="mt-2" placeholder="Code to copy" value={button.copyCode || ""} onChange={(e) => { const next = [...buttons]; next[index] = { ...button, copyCode: e.target.value }; setButtons(next); }} />}
          </div>)}
          {parseButtons(draft.data.buttonsJson).length < 3 && <Button type="button" variant="outline" onClick={() => setButtons([...parseButtons(draft.data.buttonsJson), { type: "reply", id: `button-${parseButtons(draft.data.buttonsJson).length + 1}`, displayText: "New button" }])}><Plus className="size-4" /> Add button</Button>}
        </div>
      </div>}

      {isList && <div className="space-y-3 rounded-xl border border-border p-3">
        <div><p className="text-sm font-semibold">List</p><p className="text-xs text-muted-foreground">Add up to 10 rows across your sections.</p></div>
        <div><Label>Message</Label><Textarea rows={4} value={String(draft.data.text || "")} onChange={(e) => updateData("text", e.target.value)} /></div>
        <div><Label>Menu button</Label><Input value={String(draft.data.buttonText || "View options")} onChange={(e) => updateData("buttonText", e.target.value)} /></div>
        <div className="space-y-3">
          {parseSections(draft.data.sectionsJson).map((section, sectionIndex, sections) => <div key={sectionIndex} className="rounded-lg border border-border bg-surface/50 p-3">
            <div className="mb-2 flex items-center gap-2"><Input placeholder="Section title" value={section.title || ""} onChange={(e) => { const next = [...sections]; next[sectionIndex] = { ...section, title: e.target.value }; setSections(next); }} /><Button size="sm" variant="ghost" onClick={() => setSections(sections.filter((_, i) => i !== sectionIndex))}><Trash2 className="size-4" /></Button></div>
            <div className="space-y-2">
              {section.rows.map((row, rowIndex) => <div key={rowIndex} className="rounded-md border border-border bg-background p-2">
                <div className="flex gap-2"><Input placeholder="Row ID" value={row.rowId} onChange={(e) => { const next = [...sections]; const rows = [...section.rows]; rows[rowIndex] = { ...row, rowId: e.target.value }; next[sectionIndex] = { ...section, rows }; setSections(next); }} /><Button size="sm" variant="ghost" onClick={() => { const next = [...sections]; next[sectionIndex] = { ...section, rows: section.rows.filter((_, i) => i !== rowIndex) }; setSections(next); }}><Trash2 className="size-4" /></Button></div>
                <Input className="mt-2" placeholder="Row title" value={row.title} onChange={(e) => { const next = [...sections]; const rows = [...section.rows]; rows[rowIndex] = { ...row, title: e.target.value }; next[sectionIndex] = { ...section, rows }; setSections(next); }} />
                <Input className="mt-2" placeholder="Description (optional)" value={row.description || ""} onChange={(e) => { const next = [...sections]; const rows = [...section.rows]; rows[rowIndex] = { ...row, description: e.target.value }; next[sectionIndex] = { ...section, rows }; setSections(next); }} />
              </div>)}
              <Button type="button" size="sm" variant="outline" onClick={() => { const next = [...sections]; next[sectionIndex] = { ...section, rows: [...section.rows, { rowId: `row-${section.rows.length + 1}`, title: "New option", description: "" }] }; setSections(next); }} disabled={sections.reduce((n, s) => n + s.rows.length, 0) >= 10}><Plus className="size-4" /> Add row</Button>
            </div>
          </div>)}
          <Button type="button" variant="outline" onClick={() => setSections([...parseSections(draft.data.sectionsJson), { title: "New section", rows: [] }])}><Plus className="size-4" /> Add section</Button>
        </div>
      </div>}

      <p className="text-xs text-muted-foreground">Interactive metadata is stored in structured fields; no JSON editing is required.</p>
    </div>;
  };

  const renderPreview = () => {
    const message = String(draft.data.text || draft.data.caption || "").replaceAll("{{name}}", "Vishesh").replaceAll("{{company}}", "Runaway").replaceAll("{{custom1}}", "VIP").replaceAll("{{custom2}}", "North");
    const buttons = parseButtons(draft.data.buttonsJson);
    const rows = parseSections(draft.data.sectionsJson).flatMap((section) => section.rows).slice(0, 10);
    const mime = String(draft.data.mediaMimeType || "");
    const media = String(draft.data.mediaBase64 || "");

    return <div className="flex h-full min-h-[520px] flex-col rounded-2xl border border-border bg-[#efeae2] p-4">
      <div className="mb-3 flex items-center justify-between"><div><p className="font-semibold text-navy">Live preview</p><p className="text-xs text-muted-foreground">Sample values are used for personalization.</p></div><span className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide">{draft.type}</span></div>
      <div className="flex flex-1 items-end justify-end overflow-y-auto">
        <div className="w-full max-w-[360px] rounded-xl bg-white p-3 shadow-sm">
          {media && mime.startsWith("image/") && <img src={media} alt="Template media" className="mb-3 max-h-56 w-full rounded-lg object-cover" />}
          {media && mime.startsWith("video/") && <div className="mb-3 rounded-lg bg-slate-900 p-8 text-center text-sm text-white">Video attachment</div>}
          {media && !mime.startsWith("image/") && !mime.startsWith("video/") && <div className="mb-3 rounded-lg border p-3 text-sm">Document attachment</div>}
          <p className="whitespace-pre-wrap text-sm">{message || "Your message preview will appear here."}</p>
          {["buttons", "media-buttons"].includes(draft.type) && <div className="mt-3 space-y-1">{buttons.slice(0, 3).map((button, i) => <div key={i} className="rounded-md border border-primary/20 py-2 text-center text-sm font-medium text-primary">{button.displayText || `Button ${i + 1}`}</div>)}</div>}
          {["list", "media-list"].includes(draft.type) && <div className="mt-3 space-y-1">{rows.map((row, i) => <div key={i} className="rounded-md border p-2"><p className="text-sm font-medium">{row.title || `Option ${i + 1}`}</p>{row.description && <p className="text-xs text-muted-foreground">{row.description}</p>}</div>)}<div className="mt-2 rounded-md bg-surface py-2 text-center text-xs font-medium">{String(draft.data.buttonText || "View options")}</div></div>}
          <p className="mt-1 text-right text-[10px] text-muted-foreground">now</p>
        </div>
      </div>
    </div>;
  };

  return <div className="space-y-5">
    <PageHeader title="Templates" description="Persistent reusable campaign templates. Use {{name}}, {{company}}, {{custom1}} and {{custom2}} for personalisation." actions={canManage ? <Button onClick={startCreate}><Plus className="size-4" /> New template</Button> : null} />
    {!items.length ? <EmptyState icon={FileText} title="No templates yet" description="Create a reusable message template for campaigns." action={canManage ? <Button onClick={startCreate}>Create template</Button> : undefined} /> :
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((t) => <li key={t.id} className="flex flex-col rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-navy">{t.name}</p><p className="text-xs text-muted-foreground">{t.category} · {t.type}</p></div><StatusBadge value={t.status} /></div>
        <p className="mt-3 line-clamp-4 flex-1 whitespace-pre-wrap text-sm text-muted-foreground">{preview(t)}</p>
        <div className="mt-3 flex justify-end gap-1">{canManage && <><Button size="sm" variant="ghost" onClick={() => startEdit(t)}><Pencil className="size-4" /></Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => void remove(t.id)}><Trash2 className="size-4" /></Button></>}</div>
      </li>)}</ul>}

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader><DialogTitle>{editingId ? "Edit template" : "New template"}</DialogTitle><DialogDescription>Build your message with structured controls and see the WhatsApp-style preview live.</DialogDescription></DialogHeader>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">{renderEditor()}</div>
          <div className="lg:sticky lg:top-0 lg:self-start">{renderPreview()}</div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => void save()}>{editingId ? "Save changes" : "Create template"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
