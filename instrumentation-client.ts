import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enableLogs: true,
  sendDefaultPii: false,

  // Scrub sensitive fields before sending to Sentry
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

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
