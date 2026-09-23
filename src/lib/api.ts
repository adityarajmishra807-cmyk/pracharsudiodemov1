export const apiBase=()=>String(import.meta.env.VITE_WHATSAPP_API_URL||window.location.origin).replace(/\/+$/,"");
export async function apiRequest<T>(path:string,init:RequestInit={}):Promise<T>{
 const response=await fetch(apiBase()+path,{...init,headers:{Accept:"application/json",...(init.body?{"Content-Type":"application/json"}:{}),...(init.headers||{})},cache:"no-store"});
 const body=await response.json().catch(()=>({}));
 if(!response.ok) { const e=new Error(body?.message||`Request failed (${response.status})`); (e as Error&{status?:number}).status=response.status; throw e; }
 return body as T;
}
