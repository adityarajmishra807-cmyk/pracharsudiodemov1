import { createFileRoute } from "@tanstack/react-router";
import { FileText, Lock, Pencil, Plus, Trash2 } from "lucide-react";
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

type Draft = {
  name: string;
  category: string;
  status: "draft" | "approved" | "paused";
  type: TemplateType;
  data: Record<string, unknown>;
};

const emptyDraft = (): Draft => ({
  name: "",
  category: "Marketing",
  status: "draft",
  type: "text",
  data: { text: "Hi {{name}}, " },
});

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
    setDraft({ name: t.name, category: t.category || String(t.data.category || "Marketing"), status: t.status || "draft", type: t.type, data: { ...t.data } });
    setOpen(true);
  };
  const updateData = (key: string, value: unknown) => setDraft((d) => ({ ...d, data: { ...d.data, [key]: value } }));

  const save = async () => {
    if (!draft.name.trim()) return toast.error("Template name is required.");
    const needsMessage = ["text", "media-text", "buttons", "list", "media-buttons", "media-list"].includes(draft.type);
    const text = String(draft.data.text || draft.data.caption || "").trim();
    if (needsMessage && !text) return toast.error("Message text is required.");
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

  const preview = (t: Template) => String(t.data.text || t.data.caption || t.data.title || "Interactive template");

  return <div className="space-y-5">
    <PageHeader title="Templates" description="Persistent reusable campaign templates. Use {{name}}, {{company}}, {{custom1}} and {{custom2}} for personalisation." actions={canManage ? <Button onClick={startCreate}><Plus className="size-4" /> New template</Button> : null} />
    {!items.length ? <EmptyState icon={FileText} title="No templates yet" description="Create a reusable message template for campaigns." action={canManage ? <Button onClick={startCreate}>Create template</Button> : undefined} /> :
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((t) => <li key={t.id} className="flex flex-col rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-navy">{t.name}</p><p className="text-xs text-muted-foreground">{t.category} · {t.type}</p></div><StatusBadge value={t.status} /></div>
        <p className="mt-3 line-clamp-4 flex-1 whitespace-pre-wrap text-sm text-muted-foreground">{preview(t)}</p>
        <div className="mt-3 flex justify-end gap-1">{canManage && <><Button size="sm" variant="ghost" onClick={() => startEdit(t)}><Pencil className="size-4" /></Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => void remove(t.id)}><Trash2 className="size-4" /></Button></>}</div>
      </li>)}</ul>}

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{editingId ? "Edit template" : "New template"}</DialogTitle><DialogDescription>Store the exact payload that can be loaded into a campaign.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2"><div><Label>Name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div><Label>Type</Label><Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as TemplateType, data: {} })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{types.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div></div>
          <div className="grid gap-4 sm:grid-cols-2"><div><Label>Category</Label><Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Status</Label><Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as Draft["status"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["draft","approved","paused"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div></div>

          {draft.type === "text" && <div><Label>Message</Label><Textarea rows={6} value={String(draft.data.text || "")} onChange={(e) => updateData("text", e.target.value)} /><p className="mt-1 text-xs text-muted-foreground">Variables: {"{{name}}"}, {"{{company}}"}, {"{{custom1}}"}, {"{{custom2}}"}</p></div>}
          {draft.type === "media" && <div className="space-y-3"><div><Label>Media payload</Label><Textarea rows={4} value={String(draft.data.mediaBase64 || "")} onChange={(e) => updateData("mediaBase64", e.target.value)} placeholder="Base64 media or image URL" /></div><div><Label>Message / caption</Label><Textarea value={String(draft.data.text || draft.data.caption || "")} onChange={(e) => updateData("text", e.target.value)} /></div></div>}
          {draft.type === "media-text" && <div className="space-y-3"><div><Label>Media payload</Label><Textarea rows={3} value={String(draft.data.mediaBase64 || "")} onChange={(e) => updateData("mediaBase64", e.target.value)} placeholder="Base64 media" /></div><div><Label>Message</Label><Textarea value={String(draft.data.text || draft.data.caption || "")} onChange={(e) => updateData("text", e.target.value)} /></div></div>}
                    {["buttons","media-buttons"].includes(draft.type) && <div className="space-y-3">
            <div><Label>Message</Label><Textarea rows={5} value={String(draft.data.text || "")} onChange={(e) => updateData("text", e.target.value)} placeholder="Write the message text..." /></div>
            <p className="text-xs text-muted-foreground">One message field. Title, description and footer are not used.</p>
            <div><Label>Buttons JSON</Label><Textarea rows={6} value={String(draft.data.buttonsJson || '[{"type":"reply","id":"offer","displayText":"View offer"}]')} onChange={(e) => updateData("buttonsJson", e.target.value)} placeholder='[{"type":"reply","id":"offer","displayText":"View offer"}]' /></div>
          </div>}
                    {["list","media-list"].includes(draft.type) && <div className="space-y-3">
            <div><Label>Message</Label><Textarea rows={5} value={String(draft.data.text || "")} onChange={(e) => updateData("text", e.target.value)} placeholder="Write the message text..." /></div>
            <p className="text-xs text-muted-foreground">One message field. Title, description and footer are not used.</p>
            <div><Label>Menu button</Label><Input value={String(draft.data.buttonText || "View options")} onChange={(e) => updateData("buttonText", e.target.value)} /></div>
            <div><Label>Sections JSON</Label><Textarea rows={8} value={String(draft.data.sectionsJson || '[{"title":"Options","rows":[{"rowId":"1","title":"Option 1","description":""}]}]')} onChange={(e) => updateData("sectionsJson", e.target.value)} placeholder='[{"title":"Options","rows":[{"rowId":"1","title":"Option 1"}]}]' /></div>
          </div>}
          {["media-buttons","media-list"].includes(draft.type) && <div><Label>Media payload</Label><Textarea rows={3} value={String(draft.data.mediaBase64 || "")} onChange={(e) => updateData("mediaBase64", e.target.value)} placeholder="Base64 media or image URL" /></div>}
        </div>
        <div className="mt-2 rounded-2xl border border-border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div><p className="font-semibold text-navy">Live preview</p><p className="text-xs text-muted-foreground">Uses sample personalization values.</p></div>
            <span className="rounded-full bg-surface px-2 py-1 text-[10px] font-semibold uppercase tracking-wide">{draft.type}</span>
          </div>
          <div className="flex justify-end rounded-xl bg-[#efeae2] p-3">
            <div className="w-full max-w-[340px] rounded-xl bg-white p-3 shadow-sm">
              <p className="whitespace-pre-wrap text-sm">{String(draft.data.text || draft.data.caption || "").replaceAll("{{name}}", "Vishesh").replaceAll("{{company}}", "Runaway").replaceAll("{{custom1}}", "VIP").replaceAll("{{custom2}}", "North") || "Your message preview will appear here."}</p>
              {["buttons", "media-buttons"].includes(draft.type) && <div className="mt-3 space-y-1">{(() => { try { return (JSON.parse(String(draft.data.buttonsJson || "[]")) as Array<{id?: string; displayText?: string}>).slice(0, 3); } catch { return []; } })().map((b, i) => <div key={b.id || i} className="rounded-md border border-primary/20 py-2 text-center text-sm font-medium text-primary">{b.displayText || `Button ${i + 1}`}</div>)}</div>}
              {["list", "media-list"].includes(draft.type) && <div className="mt-3"><div className="space-y-1">{(() => { try { const sections = JSON.parse(String(draft.data.sectionsJson || "[]")) as Array<{rows?: Array<{rowId?: string; title?: string; description?: string}>}>; return sections.flatMap((s) => s.rows || []).slice(0, 10); } catch { return []; } })().map((row, i) => <div key={row.rowId || i} className="rounded-md border p-2"><p className="text-sm font-medium">{row.title || `Option ${i + 1}`}</p>{row.description && <p className="text-xs text-muted-foreground">{row.description}</p>}</div>)}</div><div className="mt-2 rounded-md bg-surface py-2 text-center text-xs font-medium">{String(draft.data.buttonText || "View options")}</div></div>}
              <p className="mt-1 text-right text-[10px] text-muted-foreground">now</p>
            </div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => void save()}>{editingId ? "Save changes" : "Create template"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
