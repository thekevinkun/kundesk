// Pusher private channel auth for CUSTOMER widget channels.
// No Clerk session here — customers don't have accounts. Instead we require
// sessionId as a second factor: a channelToken seen alone (log line,
// screenshot, shared URL) isn't enough to subscribe without also knowing
// the sessionId the legitimate browser tab holds.

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { env } from "@/lib/env";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const params = new URLSearchParams(body);
  const socketId = params.get("socket_id");
  const channelName = params.get("channel_name");
  const sessionId = params.get("sessionId"); // sent via pusher-js paramsProvider

  // console.log("AUTH CHECK — channelName:", channelName, "sessionId:", sessionId);

  if (!socketId || !channelName || !sessionId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const prefix = "private-conversation-";
  if (!channelName.startsWith(prefix)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const channelToken = channelName.slice(prefix.length);

  const [conversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.channelToken, channelToken),
        eq(conversations.sessionId, sessionId),
      ),
    )
    .limit(1);

  // Same generic rejection whether token is wrong, session doesn't match,
  // or conversation doesn't exist — no enumeration signal (Layer 10 pattern)
  if (!conversation) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!env.pusherAppId || !env.pusherKey || !env.pusherSecret) {
    return NextResponse.json(
      { error: "Pusher not configured" },
      { status: 500 },
    );
  }

  const Pusher = (await import("pusher")).default;
  const pusher = new Pusher({
    appId: env.pusherAppId,
    key: env.pusherKey,
    secret: env.pusherSecret,
    cluster: env.pusherCluster,
    useTLS: true,
  });

  const authResponse = pusher.authorizeChannel(socketId, channelName);
  return NextResponse.json(authResponse);
}
