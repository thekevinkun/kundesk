import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enableLogs: true,
  sendDefaultPii: false,

  // Scrub sensitive fields before sending to Sentry
  beforeSend(event) {
    // Strip message content — never send customer chat messages to Sentry
    if (event.request?.data) {
      const data = event.request.data as Record<string, unknown>;
      if (data.message) data.message = "[scrubbed]";
      if (data.content) data.content = "[scrubbed]";
    }
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
