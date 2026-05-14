import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
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
    ];

    // Scrub from request body
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>;
      for (const key of SCRUBBED_KEYS) {
        if (key in data) data[key] = "[scrubbed]";
      }
    }

    // Scrub from extra context — sometimes logged manually
    if (event.extra) {
      for (const key of SCRUBBED_KEYS) {
        if (key in event.extra) event.extra[key] = "[scrubbed]";
      }
    }

    return event;
  },
});
