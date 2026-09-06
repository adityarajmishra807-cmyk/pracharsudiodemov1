import {
  getWhatsAppChat,
  listWhatsAppChats,
  updateWhatsAppChat,
} from "../core/api.server";

export const chatService = {
  list: listWhatsAppChats,
  get: getWhatsAppChat,
  update: updateWhatsAppChat,
};
