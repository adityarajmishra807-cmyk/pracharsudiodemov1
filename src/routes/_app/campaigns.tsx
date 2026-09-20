import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, Megaphone, Pause, Play, Plus, RefreshCw, RotateCcw, Square } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, useStore, type LeadStatus } from "@/lib/store";
import { campaignsApi, type Campaign } from "@/lib/campaigns-api";

export const Route = createFileRoute("/_app/campaigns")({
  head: () => ({
    meta: [
      { title: "Campaigns — Prachar Studio CRM" },
      {
        name: "description",
        content:
          "Build WhatsApp broadcast campaigns: pick an audience from your leads, attach a template and track campaign status.",
      },
      { property: "og:title", content: "Campaigns — Prachar Studio CRM" },
      {
        property: "og:description",
        content: "Audience selection, template attachment and status tracking.",
      },
    ],
  }),
  component: CampaignsPage,
});

const STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];

function CampaignsPage() {
  const { state, can } = useStore();
  const [campaigns,setCampaigns]=useState<Campaign[]>([]);
  const [open,setOpen]=useState(false);
  const [name,setName]=useState("");
  const [instance,setInstance]=useState("");
  const [type,setType]=useState("text");
  const [text,setText]=useState("Hello {{name}}, we have an offer for {{company}}.");
  const [recipients,setRecipients]=useState("");
  const [delayMs,setDelayMs]=useState("1500");
  const [busy,setBusy]=useState(false);

  const load=async()=>{try{setCampaigns(await campaignsApi.list())}catch(e){toast.error(e instanceof Error?e.message:"Could not load campaigns")}};
  useEffect(()=>{void load();const t=window.setInterval(()=>void load(),5000);return()=>window.clearInterval(t)},[]);
  const connected=state.whatsappSessions?.filter?.((s:any)=>["open","connected","online"].includes(String(s.state||s.status||"").toLowerCase()))||[];
  const create=async()=>{
    const rows=recipients.split(/[\n,]+/).map(phone=>phone.trim()).filter(Boolean).map(phone=>({phone}));
    if(!name.trim()||!instance||!rows.length||!text.trim())return toast.error("Campaign name, instance, message and recipients are required.");
    if(rows.length>250)return toast.error("Maximum 250 recipients per campaign.");
    setBusy(true);try{await campaignsApi.create({name:name.trim(),type,instance,recipients:rows,delayMs:Number(delayMs)||1500,payload:{text:text.trim()}});toast.success("Campaign queued");setOpen(false);setName("");setRecipients("");await load()}catch(e){toast.error(e instanceof Error?e.message:"Campaign creation failed")}finally{setBusy(false)}
  };
  const action=async(id:string,fn:(id:string)=>Promise<Campaign>,msg:string)=>{try{await fn(id);toast.success(msg);await load()}catch(e){toast.error(e instanceof Error?e.message:"Action failed")}};
  if(!can("campaigns"))return <div className="space-y-5"><PageHeader title="Campaigns"/><EmptyState icon={Lock} title="No campaign access" description="Ask the workspace owner to enable campaigns for your account."/></div>;
  return <div className="space-y-5">
    <PageHeader title="Campaigns" description="Persistent WhatsApp campaigns backed by the Evolution worker." actions={<Button onClick={()=>setOpen(true)}><Plus className="size-4"/> New campaign</Button>}/>
    {!campaigns.length?<EmptyState icon={Megaphone} title="No campaigns yet" description="Create a persistent campaign and the background worker will process it." action={<Button onClick={()=>setOpen(true)}>Create campaign</Button>}/>:<ul className="grid gap-3 lg:grid-cols-2">{campaigns.map(c=><li key={c.id} className="rounded-lg border border-border bg-card p-4">
      <div className="flex justify-between gap-3"><div><p className="font-semibold text-navy">{c.name}</p><p className="text-xs text-muted-foreground">{c.type} · {c.instance} · {formatDate(c.createdAt)}</p></div><StatusBadge value={c.status}/></div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-sm"><div><span className="text-xs text-muted-foreground">Total</span><p>{c.total}</p></div><div><span className="text-xs text-muted-foreground">Sent</span><p>{c.sent}</p></div><div><span className="text-xs text-muted-foreground">Failed</span><p>{c.failed}</p></div><div><span className="text-xs text-muted-foreground">Remaining</span><p>{Math.max(0,c.total-c.sent-c.failed)}</p></div></div>
      {c.error&&<p className="mt-2 text-sm text-destructive">{c.error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {["queued","running"].includes(c.status)&&<Button size="sm" variant="outline" onClick={()=>void action(c.id,campaignsApi.pause,"Paused")}><Pause className="size-3.5"/> Pause</Button>}
        {c.status==="paused"&&<Button size="sm" onClick={()=>void action(c.id,campaignsApi.resume,"Resumed")}><Play className="size-3.5"/> Resume</Button>}
        {["queued","running","paused"].includes(c.status)&&<Button size="sm" variant="outline" onClick={()=>void action(c.id,campaignsApi.cancel,"Cancelled")}><Square className="size-3.5"/> Cancel</Button>}
        {c.failed>0&&<Button size="sm" variant="outline" onClick={()=>void action(c.id,campaignsApi.retryFailed,"Retry queued")}><RotateCcw className="size-3.5"/> Retry failed</Button>}
        <Button size="sm" variant="ghost" onClick={()=>void load()}><RefreshCw className="size-3.5"/></Button>
      </div>
    </li>)}</ul>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>New WhatsApp campaign</DialogTitle><DialogDescription>Create a persistent queued campaign.</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div><Label>Campaign name</Label><Input value={name} onChange={e=>setName(e.target.value)} placeholder="Summer offer"/></div>
        <div><Label>Evolution instance</Label><Select value={instance} onValueChange={setInstance}><SelectTrigger><SelectValue placeholder="Select instance"/></SelectTrigger><SelectContent>{connected.map((s:any)=><SelectItem key={s.instanceName} value={s.instanceName}>{s.instanceName}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Message type</Label><Select value={type} onValueChange={setType}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["text","media-text","buttons","list","media-buttons","media-list"].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Recipients (one phone per line)</Label><Textarea value={recipients} onChange={e=>setRecipients(e.target.value)} placeholder="919999999999&#10;918888888888"/></div>
        <div><Label>Message</Label><Textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Hello {{name}}"/></div>
        <div><Label>Delay (ms, minimum 1500)</Label><Input type="number" min={1500} max={10000} value={delayMs} onChange={e=>setDelayMs(e.target.value)}/></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={busy} onClick={()=>void create()}>{busy?"Creating…":"Create & queue"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}