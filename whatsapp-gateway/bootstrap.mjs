console.log("[BOOT] Prachar WhatsApp gateway bootstrap starting");
console.log("[BOOT] Node version:", process.version);
console.log("[BOOT] PORT:", process.env.PORT || "<not set>");
console.log("[BOOT] HOST:", process.env.HOST || "0.0.0.0");
console.log("[BOOT] Working directory:", process.cwd());
console.log("[BOOT] Gateway URL configuration present:", Boolean(process.env.WHATSAPP_GATEWAY_SECRET));

process.on("uncaughtException", (error) => {
  console.error("[BOOT][UNCAUGHT_EXCEPTION]", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("[BOOT][UNHANDLED_REJECTION]", reason);
});

try {
  console.log("[BOOT] Importing gateway application...");
  await import("./server.mjs");
  console.log("[BOOT] Gateway application module loaded successfully");
} catch (error) {
  console.error("[BOOT][FATAL] Gateway application failed to start", error);
  process.exitCode = 1;
}
