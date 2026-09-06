import { Loader2, Smartphone } from "lucide-react";

import type { WhatsAppSession } from "@/lib/whatsapp";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function labelFor(session: WhatsAppSession) {
  return session.me?.name || session.me?.id?.split(":")[0] || session.sessionId;
}

export function WhatsAppAccountSelect({
  sessions,
  value,
  onChange,
  loading = false,
}: {
  sessions: WhatsAppSession[];
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
}) {
  return (
    <div className="relative w-full sm:w-72">
      <Select value={value} onValueChange={onChange} disabled={loading || sessions.length === 0}>
        <SelectTrigger className="w-full pr-9" aria-label="WhatsApp account">
          <SelectValue placeholder={loading ? "Loading WhatsApp accounts…" : "Select WhatsApp account"} />
        </SelectTrigger>
        <SelectContent>
          {sessions.map((session) => (
            <SelectItem key={session.sessionId} value={session.sessionId}>
              {labelFor(session)}{session.me?.id ? ` · ${session.me.id.split(":")[0]}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {loading ? <Loader2 className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" /> : <Smartphone className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />}
    </div>
  );
}
