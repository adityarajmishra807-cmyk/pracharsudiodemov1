import { MessageCircle, Users } from "lucide-react";

import type { WhatsAppChat } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

function chatName(chat: WhatsAppChat) {
  return chat.name || (chat.isGroup ? "Group" : chat.jid.split("@")[0]);
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

export function WhatsAppChatList({
  chats,
  selectedJid,
  loading,
  onSelect,
}: {
  chats: WhatsAppChat[];
  selectedJid: string | null;
  loading: boolean;
  onSelect: (jid: string) => void;
}) {
  if (loading && chats.length === 0) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Loading conversations…</div>;
  }

  if (chats.length === 0) {
    return (
      <div className="px-5 py-12 text-center">
        <MessageCircle className="mx-auto size-7 text-muted-foreground" />
        <p className="mt-3 font-medium text-navy">No conversations yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Messages received by this account will appear here.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {chats.filter((chat) => !chat.archived).map((chat) => {
        const name = chatName(chat);
        return (
          <button
            key={chat.jid}
            type="button"
            onClick={() => onSelect(chat.jid)}
            className={cn("w-full px-4 py-3 text-left transition-colors hover:bg-surface", selectedJid === chat.jid && "bg-primary/10")}
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
                {chat.isGroup ? <Users className="size-4" /> : initials(name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-navy">{name}</span>
                  {chat.unreadCount > 0 ? <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">{chat.unreadCount}</span> : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{chat.isGroup ? "Group" : chat.jid.split("@")[0]}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
