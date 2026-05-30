// Health check endpoint — used by Vercel and monitoring tools
// Returns 200 when the app is alive and DB is reachable
// If this returns non-200, Vercel restarts the instance

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET(): Promise<NextResponse> {
  try {
    // Lightweight DB ping — confirms Neon connection is alive
    // SELECT 1 is the cheapest possible query — no table scan
    await db.execute(sql`SELECT 1`);

    return NextResponse.json({
      ok: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  } catch {
    // DB unreachable — return 503 so Vercel knows something is wrong
    return NextResponse.json(
      {
        ok: false,
        status: "unhealthy",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
