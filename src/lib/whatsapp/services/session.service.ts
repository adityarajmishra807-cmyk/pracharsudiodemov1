import {
  checkWhatsAppBackend,
  deleteWhatsAppSession,
  getWhatsAppSessionStatus,
  listWhatsAppSessions,
  logoutWhatsAppSession,
  startWhatsAppSession,
} from "../core/api.server";

export const sessionService = {
  health: checkWhatsAppBackend,
  list: listWhatsAppSessions,
  start: startWhatsAppSession,
  status: getWhatsAppSessionStatus,
  logout: logoutWhatsAppSession,
  remove: deleteWhatsAppSession,
};
