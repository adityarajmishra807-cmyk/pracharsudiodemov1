import { useSession } from "@tanstack/react-start/server";

export type AppSessionData =
  | { role: "owner"; email: string }
  | { role: "license"; licenseId: string; licenseType: "permanent" | "trial"; expiresAt: string | null }
  | Record<string, never>;

export function useAppSession() {
  const password = process.env.PRACHAR_SESSION_SECRET;

  if (!password || password.length < 32) {
    throw new Error("PRACHAR_SESSION_SECRET must be configured with at least 32 characters.");
  }

  return useSession<AppSessionData>({
    name: "__Host-prachar-session",
    password,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    },
  });
}
