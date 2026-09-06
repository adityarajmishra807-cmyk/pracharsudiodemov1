import {
  deleteWhatsAppMessage,
  editWhatsAppMessage,
  getWhatsAppHistory,
  markWhatsAppMessagesRead,
  reactToWhatsAppMessage,
  sendWhatsAppMessage,
} from "../core/api.server";

export const messageService = {
  history: getWhatsAppHistory,
  sendText: sendWhatsAppMessage,
  markRead: markWhatsAppMessagesRead,
  edit: editWhatsAppMessage,
  remove: deleteWhatsAppMessage,
  react: reactToWhatsAppMessage,
};
