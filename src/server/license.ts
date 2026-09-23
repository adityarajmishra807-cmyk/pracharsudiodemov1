import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  activateLicense,
  insertLicense,
  listLicenses,
  normalizeLicenseKey,
  revokeLicense,
} from "./license-store";
import { useAppSession } from "./session";

const licenseTypeSchema = z.object({
  type: z.enum(["permanent", "trial"]),
});

const activationSchema = z.object({
  key: z.string().min(12).max(64),
  customerName: z.string().trim().max(120).default(""),
  customerEmail: z.string().trim().email().max(254).or(z.literal("")).default(""),
});

async function requireOwner() {
  const session = await useAppSession();
  if (session.data.role !== "owner") {
    throw new Error("OWNER_REQUIRED");
  }
  return session;
}

export const listLicensesFn = createServerFn({ method: "GET" }).handler(async () => {
  await requireOwner();
  return await listLicenses();
});

export const generateLicenseFn = createServerFn({ method: "POST" })
  .validator((data) => licenseTypeSchema.parse(data))
  .handler(async ({ data }) => {
    await requireOwner();
    return await insertLicense(data.type);
  });

export const revokeLicenseFn = createServerFn({ method: "POST" })
  .validator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    await requireOwner();
    return await revokeLicense(data.id);
  });

export const activateLicenseFn = createServerFn({ method: "POST" })
  .validator((data) => activationSchema.parse(data))
  .handler(async ({ data }) => {
    const license = await activateLicense(
      normalizeLicenseKey(data.key),
      data.customerName,
      data.customerEmail,
    );

    const session = await useAppSession();
    await session.update({
      role: "license",
      licenseId: license.id,
      licenseType: license.type,
      expiresAt: license.expires_at,
    });

    return {
      ok: true as const,
      license: {
        id: license.id,
        type: license.type,
        expiresAt: license.expires_at,
      },
    };
  });
