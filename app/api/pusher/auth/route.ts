// Pusher private channel authentication endpoint
// Validates that the requesting user belongs to the org before granting channel access
// Called automatically by Pusher client SDK when subscribing to private-* channels

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { env } from "@/lib/env";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Only authenticated dashboard users can subscribe to private channels
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.text();
  const params = new URLSearchParams(body);
  const socketId = params.get("socket_id");
  const channelName = params.get("channel_name");

  if (!socketId || !channelName) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  // Validate the channel name matches the requesting user's org
  // Channel format: private-org-{orgId}
  const expectedChannel = `private-org-${orgId}`;
  if (channelName !== expectedChannel) {
    // User is trying to subscribe to another org's channel — reject
    console.warn("[pusher/auth] Channel mismatch", {
      expected: expectedChannel,
      requested: channelName,
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // All credentials required — validated at startup in env.ts
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

  // Generate auth signature — Pusher validates this on their end
  const authResponse = pusher.authorizeChannel(socketId, channelName);
  return NextResponse.json(authResponse);
}
