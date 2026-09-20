export type AuthUser = { id:string; email:string; role:string; memberId?:string|null; name:string; permissions:Record<string,boolean> };
export type AuthResponse = { token:string; user:AuthUser };
const TOKEN_KEY="prachar-auth-token";
const base=()=>String(import.meta.env.VITE_WHATSAPP_API_URL||window.location.origin).replace(/\/+$/,"");
export const authToken=()=>window.localStorage.getItem(TOKEN_KEY)||"";
export const setAuthToken=(token:string)=>window.localStorage.setItem(TOKEN_KEY,token);
export const clearAuthToken=()=>window.localStorage.removeItem(TOKEN_KEY);
async function request<T>(path:string,init:RequestInit={}){
 const r=await fetch(base()+path,{...init,headers:{Accept:"application/json",...(init.body?{"Content-Type":"application/json"}:{}),...(authToken()?{Authorization:`Bearer ${authToken()}`}:{}),...(init.headers||{})},cache:"no-store"});
 const b=await r.json().catch(()=>({})); if(!r.ok) throw new Error(b?.message||`Request failed (${r.status})`); return b as T;
}
export const authApi={login:(email:string,password:string)=>request<AuthResponse>("/api/auth/login",{method:"POST",body:JSON.stringify({email,password})}),setup:(email:string,password:string)=>request<AuthResponse>("/api/auth/setup",{method:"POST",body:JSON.stringify({email,password})}),me:()=>request<{id:string;email:string;role:string;memberId?:string|null;name:string;permissions:Record<string,boolean>}>("/api/auth/me"),logout:()=>request<void>("/api/auth/logout",{method:"POST"})};
