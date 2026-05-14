import * as Sentry from "@sentry/nextjs";
import { env } from "./lib/env";

Sentry.init({
  dsn: env.sentryDsn,
  tracesSampleRate: 0.1,
  enableLogs: true,
  sendDefaultPii: false,

  // Same scrubbing as server — edge routes handle webhook data
  beforeSend(event) {
    const SCRUBBED_KEYS = [
      "password",
      "token",
      "secret",
      "embedding",
      "content",
      "message",
      "apiKey",
      "authorization",
    ];

    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>;
      for (const key of SCRUBBED_KEYS) {
        if (key in data) data[key] = "[scrubbed]";
      }
    }

    return event;
  },
});
