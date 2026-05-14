import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";

Sentry.init({
  dsn: env.sentryDsn,
  tracesSampleRate: 0.1,
  enableLogs: true,
  sendDefaultPii: false,

  beforeSend(event) {
    // Scrub sensitive fields — chat content, embeddings, tokens never go to Sentry
    const SCRUBBED_KEYS = [
      "password",
      "token",
      "secret",
      "embedding",
      "content",
      "message",
      "apiKey",
      "authorization",
    ].map((k) => k.toLowerCase());

    // Recursively scrub any object or array
    function scrubObject(obj: unknown): void {
      if (!obj || typeof obj !== "object") return;

      if (Array.isArray(obj)) {
        obj.forEach(scrubObject);
        return;
      }

      for (const key in obj) {
        if (SCRUBBED_KEYS.includes(key.toLowerCase())) {
          (obj as Record<string, unknown>)[key] = "[scrubbed]";
        } else {
          scrubObject((obj as Record<string, unknown>)[key]);
        }
      }
    }

    scrubObject(event.request?.data);
    scrubObject(event.extra);

    return event;
  },
});
