export type WhatsAppMessage = {
  id: string;
  accountId: string;
  chatId: string;
  from: string;
  to: string;
  direction: "in" | "out";
  text: string;
  at: string;
  status: "received" | "sent" | "failed";
};

export type WhatsAppChat = {
  id: string;
  accountId: string;
  phoneNumber: string;
  name: string;
  unread: number;
  lastMessage: string;
  lastMessageAt: string;
  messages: WhatsAppMessage[];
};
