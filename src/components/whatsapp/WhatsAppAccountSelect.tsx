import type { WhatsAppSession } from "@/lib/whatsapp";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function labelFor(session: WhatsAppSession) {
  return session.me?.name || session.me?.id?.split(":")[0] || session.sessionId;
}

export function WhatsAppAccountSelect({
  sessions,
  value,
  onChange,
}: {
  sessions: WhatsAppSession[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-72" aria-label="WhatsApp account">
        <SelectValue placeholder="Select WhatsApp account" />
      </SelectTrigger>
      <SelectContent>
        {sessions.map((session) => (
          <SelectItem key={session.sessionId} value={session.sessionId}>
            {labelFor(session)}{session.me?.id ? ` · ${session.me.id.split(":")[0]}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
