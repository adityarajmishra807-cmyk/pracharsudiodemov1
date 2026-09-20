import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi, setAuthToken, authToken } from "@/lib/auth-api";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Sign in — Prachar Studio" }] }),
  component: EntryScreen,
});

function EntryScreen() {
  const { ready, signIn } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [setupMode, setSetupMode] = useState(false);

  useEffect(() => {
    if (!ready || !authToken()) return;
    void authApi.me().then((user) => {
      signIn({ kind: "owner" });
      void router.navigate({ to: "/dashboard" });
    }).catch(() => {});
  }, [ready, router, signIn]);

  const submit = async () => {
    if (!termsAccepted) return toast.error("Accept the Terms & Conditions to continue.");
    if (!email.trim() || !password) return toast.error("Enter your email and password.");
    setLoading(true);
    try {
      const result = setupMode
        ? await authApi.setup(email.trim(), password)
        : await authApi.login(email.trim(), password);
      setAuthToken(result.token);
      signIn({ kind: result.user.role === "owner" ? "owner" : "member", ...(result.user.role === "owner" ? {} : { memberId: result.user.memberId || "" }) });
      toast.success(setupMode ? "Workspace created." : "Signed in.");
      void router.navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return <div className="flex min-h-screen flex-col lg:grid lg:grid-cols-2">
    <section className="flex flex-1 flex-col justify-between bg-navy px-6 py-8 lg:px-12 lg:py-12">
      <Logo onDark />
      <div className="mt-10 lg:mt-0">
        <h1 className="max-w-md text-2xl leading-tight font-extrabold text-white lg:text-4xl">WhatsApp CRM & messaging workspace</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70 lg:text-base">Manage Evolution instances, recipients, campaigns, templates and analytics from one authenticated workspace.</p>
      </div>
      <p className="mt-10 text-xs text-white/45 lg:mt-0">Prachar Studio · Secure workspace access</p>
    </section>
    <section className="flex flex-1 items-center justify-center bg-white px-5 py-10 lg:px-12">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 text-primary"><ShieldCheck className="size-5" /><span className="text-xs font-semibold uppercase tracking-wider">Secure sign in</span></div>
        <h2 className="mt-3 text-2xl font-bold text-navy">{setupMode ? "Create workspace owner" : "Welcome back"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{setupMode ? "Create the first owner account for this Supabase workspace." : "Sign in with your Prachar Studio account."}</p>
        <div className="mt-6 space-y-4">
          <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" className="mt-1.5 h-11" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@company.com" /></div>
          <div><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete={setupMode ? "new-password" : "current-password"} className="mt-1.5 h-11" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder={setupMode ? "At least 8 characters" : "Your password"} onKeyDown={(e)=>{if(e.key==="Enter")void submit();}} /></div>
          <div className="flex items-start gap-3 rounded-lg border bg-surface p-3"><Checkbox id="terms" checked={termsAccepted} onCheckedChange={(v)=>setTermsAccepted(v===true)} /><Label htmlFor="terms" className="cursor-pointer text-xs leading-5">I agree to the <a href="/terms" className="font-semibold underline">Terms & Conditions</a>.</Label></div>
          <Button className="h-11 w-full" disabled={loading || !ready} onClick={()=>void submit()}>{loading ? "Please wait…" : setupMode ? "Create workspace" : "Sign in"}<ArrowRight className="ml-2 size-4" /></Button>
          <button type="button" className="w-full text-center text-xs font-medium text-muted-foreground hover:text-primary" onClick={()=>setSetupMode((v)=>!v)}>{setupMode ? "Already have an account? Sign in" : "First time setup? Create owner account"}</button>
        </div>
      </div>
    </section>
  </div>;
}
