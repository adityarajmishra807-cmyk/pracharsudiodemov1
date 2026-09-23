import pg from "pg";
import "dotenv/config";
const {Client}=pg;
const sourceUrl=process.env.SOURCE_DATABASE_URL;
const targetUrl=process.env.SUPABASE_DB_URL;
if(!sourceUrl||!targetUrl) throw new Error("SOURCE_DATABASE_URL and SUPABASE_DB_URL are required.");
const tables=["members","app_users","auth_sessions","workspace_settings","leads","lead_activity","conversations","messages","templates","audiences","audience_recipients","campaigns","campaign_recipients","campaign_results","campaign_messages","automations","automation_nodes"];
const source=new Client({connectionString:sourceUrl}); const target=new Client({connectionString:targetUrl});
await source.connect(); await target.connect();
try {
 for(const table of tables){
  const result=await source.query("select * from public."+JSON.stringify(table)); const rows=result.rows;
  if(!rows.length){console.log(table+": empty");continue;}
  const cols=Object.keys(rows[0]); await target.query("begin");
  try {
   for(const row of rows){
    const vals=cols.map(c=>row[c]); const params=vals.map((_,i)=>"$"+(i+1)).join(",");
    const names=cols.map(c=>JSON.stringify(c)).join(",");
    await target.query("insert into public."+JSON.stringify(table)+" ("+names+") values ("+params+") on conflict do nothing",vals);
   }
   await target.query("commit"); console.log(table+": "+rows.length+" rows");
  } catch(e){await target.query("rollback");throw e;}
 }
} finally {await source.end();await target.end();}