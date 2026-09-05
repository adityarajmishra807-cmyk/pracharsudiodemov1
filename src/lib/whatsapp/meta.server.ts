import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CompleteSignupSchema = z.object({
  code: z.string().min(1),
  wabaId: z.string().min(1).optional(),
  phoneNumberId: z.string().min(1).optional(),
});

type GraphError = {
  error?: {
    message?: string;
  };
};

type PhoneNumber = {
  id?: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
};

async function graphJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = (await response.json()) as T & GraphError;
  if (!response.ok) {
    throw new Error(body.error?.message || "Meta Graph API request failed.");
  }
  return body as T;
}

export const completeWhatsAppSignup = createServerFn({ method: "POST" })
  .validator(CompleteSignupSchema)
  .handler(async ({ data }) => {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const version = process.env.META_GRAPH_VERSION || "v26.0";

    if (!appId || !appSecret) {
      throw new Error("Meta WhatsApp onboarding is not configured on the server yet.");
    }

    const exchange = await graphJson<{ access_token?: string }>(
      `https://graph.facebook.com/${version}/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(data.code)}`,
    );

    if (!exchange.access_token) {
      throw new Error("Meta did not return a business access token.");
    }

    // Never return the business token to the browser. It must remain server-side.
    // The WABA/phone identifiers below are non-secret identifiers used by the UI.
    if (!data.wabaId) {
      return {
        connected: false,
        requiresSelection: true,
        message: "Meta signup completed, but no WhatsApp Business Account identifier was received.",
      };
    }

    let phoneNumbers = await graphJson<{ data?: PhoneNumber[] }>(
      `https://graph.facebook.com/${version}/${encodeURIComponent(data.wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`,
      {
        headers: {
          Authorization: `Bearer ${exchange.access_token}`,
        },
      },
    );

    let selectedPhone: PhoneNumber | undefined;
    if (data.phoneNumberId) {
      selectedPhone = phoneNumbers.data?.find((phone) => phone.id === data.phoneNumberId);
    }
    selectedPhone ||= phoneNumbers.data?.[0];

    if (!selectedPhone?.id || !selectedPhone.display_phone_number) {
      return {
        connected: false,
        requiresSelection: true,
        wabaId: data.wabaId,
        message: "The WhatsApp Business Account connected, but no phone number was returned.",
      };
    }

    return {
      connected: true,
      wabaId: data.wabaId,
      phoneNumberId: selectedPhone.id,
      phoneNumber: selectedPhone.display_phone_number,
      displayName: selectedPhone.verified_name || selectedPhone.display_phone_number,
      qualityRating: selectedPhone.quality_rating || null,
    };
  });
