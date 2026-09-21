import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecipientImporter, type RecipientRow } from "@/components/RecipientImporter";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/_app/audiences")({ component: AudiencesPage });

function AudiencesPage() {
  const [list, setList] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);

  const load = async () => { try { setList(await apiRequest("/api/audiences")); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not load audiences"); } };
  useEffect(() => { void load(); }, []);

  const create = async () => {
    if (!name.trim()) return toast.error("Audience name is required.");
    if (!recipients.length) return toast.error("Add at least one valid recipient.");
    if (recipients.length > 2500) return toast.error("Maximum 2500 recipients per audience.");
    try {
      await apiRequest("/api/audiences", { method: "POST", body: JSON.stringify({ name: name.trim(), description: description.trim(), recipients }) });
      toast.success("Audience created.");
      setName(""); setDescription(""); setRecipients([]); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not create audience"); }
  };

  const remove = async (id: string) => {
    try { await apiRequest("/api/audiences/" + encodeURIComponent(id), { method: "DELETE" }); toast.success("Audience deleted."); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete audience"); }
  };

  return <div className="space-y-5">
    <div><p className="text-xs font-semibold tracking-wider text-primary">AUDIENCES</p><h1 className="text-2xl font-bold text-navy">Audiences</h1><p className="text-sm text-muted-foreground">Persistent recipient lists for campaigns, with spreadsheet validation.</p></div>
    <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
      <div className="space-y-4 rounded-xl border border-border bg-white p-4">
        <Input placeholder="Audience name" value={name} onChange={e => setName(e.target.value)} />
        <Input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
        <RecipientImporter value={recipients} onChange={setRecipients} max={2500} />
        <Button onClick={() => void create()}><Plus className="mr-2 size-4" />Create audience</Button>
      </div>
      <div className="space-y-2">{list.map(a => <div key={a.id} className="flex items-center justify-between rounded-xl border bg-white p-4">
        <div><strong className="text-sm">{a.name}</strong><p className="text-xs text-muted-foreground">{a.description || "No description"} · {a.total || 0} recipients</p></div>
        <Button variant="ghost" size="icon" onClick={() => void remove(a.id)}><Trash2 className="size-4" /></Button>
      </div>)}</div>
    </div>
  </div>;
}
