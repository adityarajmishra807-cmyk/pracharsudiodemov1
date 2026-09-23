import { formatDate } from "@/lib/store";

export type LicenseType = "permanent" | "trial";
export type LicenseStatus = "unused" | "active" | "expired" | "revoked";

export type LicenseKey = {
  id: string;
  key: string;
  type: LicenseType;
  status: LicenseStatus;
  createdAt: string;
  activatedAt: string | null;
  expiresAt: string | null;
  customerName: string;
  customerEmail: string;
  deviceId: string | null;
};

export const LICENSE_STORAGE_KEY = "prachar-studio-license-v1";
export const LICENSE_DEVICE_KEY = "prachar-studio-device-v1";
export const TRIAL_DAYS = 7;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomPart(length = 4) {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
  }
  return Array.from({ length }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
}

export function generateLicenseKey() {
  return `PRA-${randomPart()}-${randomPart()}-${randomPart()}-${randomPart()}`;
}

export function createDeviceId() {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem(LICENSE_DEVICE_KEY);
  if (existing) return existing;
  const id = `device-${randomPart(8).toLowerCase()}-${Date.now().toString(36)}`;
  window.localStorage.setItem(LICENSE_DEVICE_KEY, id);
  return id;
}

export function normalizeLicenseKey(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function isLicenseExpired(license: LicenseKey, at = new Date()) {
  return license.expiresAt ? new Date(license.expiresAt).getTime() <= at.getTime() : false;
}

export function getLicenseStatus(license: LicenseKey, at = new Date()): LicenseStatus {
  if (license.status === "revoked") return "revoked";
  if (license.expiresAt && isLicenseExpired(license, at)) return "expired";
  return license.status;
}

export function formatLicenseExpiry(expiresAt: string | null) {
  return expiresAt ? formatDate(expiresAt) : "Never";
}

export function trialExpiry(from = new Date()) {
  return new Date(from.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function hydrateLicenseStatuses(keys: LicenseKey[], at = new Date()) {
  return keys.map((license) => {
    const status = getLicenseStatus(license, at);
    return status === license.status ? license : { ...license, status };
  });
}
