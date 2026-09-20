import { Upload, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import * as XLSX from "xlsx";

export type RecipientRow = { phone: string; name: string; company: string; custom1: string; custom2: string };

type Props = { value: RecipientRow[]; onChange: (rows: RecipientRow[]) => void; max?: number };

const aliases: Record<string,string> = { phone:"phone",number:"phone","phone number":"phone",mobile:"phone",name:"name",company:"company",custom1:"custom1","custom 1":"custom1",custom2:"custom2","custom 2":"custom2" };

function parseText(value:string): RecipientRow[] {
  return value.split(/\r?\n/).map(line => {
    const [phone="",name="",company="",custom1="",custom2=""] = line.split(",").map(v=>v.trim());
    return {phone,name,company,custom1,custom2};
  }).filter(r=>r.phone);
}

export function RecipientImporter({ value, onChange, max=250 }: Props) {
  const [issues,setIssues]=useState<string[]>([]);
  const [raw,setRaw]=useState(value.map(r=>[r.phone,r.name,r.company,r.custom1,r.custom2].join(",")).join("\n"));

  const apply=(rows:RecipientRow[], source="Recipient list")=>{
    const valid:RecipientRow[]=[]; const seen=new Set<string>(); const next:string[]=[];
    rows.forEach((row,i)=>{
      const phone=row.phone.replace(/\D/g,"");
      if(!phone){next.push(`Row ${i+1}: phone is empty.`);return;}
      if(phone.length<8||phone.length>15){next.push(`Row ${i+1}: invalid phone number.`);return;}
      if(seen.has(phone)){next.push(`Row ${i+1}: duplicate phone number.`);return;}
      seen.add(phone);valid.push({...row,phone});
    });
    if(valid.length>max){toast.error(`Maximum ${max} recipients allowed.`);return;}
    setIssues(next); onChange(valid); setRaw(valid.map(r=>[r.phone,r.name,r.company,r.custom1,r.custom2].join(",")).join("\n"));
    toast.success(`${source}: ${valid.length} valid recipients.`);
  };

  const importFile=async(file:File)=>{
    try{
      const wb=XLSX.read(await file.arrayBuffer(),{type:"array"}); const sheet=wb.Sheets[wb.SheetNames[0]];
      if(!sheet)throw new Error("Spreadsheet has no sheets.");
      const source=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:""});
      if(!source.length)throw new Error("Spreadsheet is empty.");
      const rows=source.map(row=>{
        const mapped:Record<string,string>={};
        Object.entries(row).forEach(([key,val])=>{const k=key.trim().toLowerCase().replace(/[_-]/g," "); mapped[aliases[k]||k]=String(val??"").trim();});
        return {phone:mapped.phone||"",name:mapped.name||"",company:mapped.company||"",custom1:mapped.custom1||"",custom2:mapped.custom2||""};
      });
      apply(rows,"Spreadsheet import");
    }catch(e){toast.error(e instanceof Error?e.message:"Could not import spreadsheet.");}
  };

  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={()=>document.getElementById("recipient-import")?.click()}><Upload className="size-4"/> Import XLSX / XLS / CSV</Button>
      <input id="recipient-import" className="hidden" type="file" accept=".xlsx,.xls,.csv,text/csv" onChange={e=>{const f=e.target.files?.[0];if(f)void importFile(f);e.currentTarget.value="";}}/>
      {value.length>0&&<Button type="button" variant="ghost" onClick={()=>{onChange([]);setRaw("");setIssues([])}}><X className="size-4"/> Clear</Button>}
    </div>
    <Textarea value={raw} onChange={e=>{setRaw(e.target.value);apply(parseText(e.target.value),"Manual recipients")}} placeholder="phone,name,company,custom1,custom2" />
    <p className="text-xs text-muted-foreground">Columns: phone, name, company, custom1, custom2 · maximum {max} recipients.</p>
    {value.length>0&&<div className="rounded-md border p-3 text-sm"><strong>{value.length} valid recipients</strong><div className="mt-2 max-h-28 overflow-auto text-xs">{value.slice(0,5).map((r,i)=><p key={i}>{r.phone} · {r.name||"No name"} · {r.company||"No company"}</p>)}</div></div>}
    {issues.length>0&&<details className="rounded-md border p-3 text-xs"><summary className="cursor-pointer font-medium">{issues.length} validation issues</summary><ul className="mt-2 space-y-1">{issues.map((x,i)=><li key={i}>{x}</li>)}</ul></details>}
  </div>;
}
