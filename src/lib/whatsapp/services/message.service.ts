import {
  deleteWhatsAppMessage,
  editWhatsAppMessage,
  getWhatsAppHistory,
  markWhatsAppMessagesRead,
  reactToWhatsAppMessage,
  sendWhatsAppContact,
  sendWhatsAppMedia,
  sendWhatsAppMessage,
} from "../core/api.server";

export const messageService = {
  history: getWhatsAppHistory,
  sendText: sendWhatsAppMessage,
  sendMedia: sendWhatsAppMedia,
  sendContact: sendWhatsAppContact,
  markRead: markWhatsAppMessagesRead,
  edit: editWhatsAppMessage,
  remove: deleteWhatsAppMessage,
  react: reactToWhatsAppMessage,
};
