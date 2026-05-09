// Drizzle ORM client — connected to Neon serverless PostgreSQL
// Uses neon-serverless Pool with WebSocket — supports transactions
// Import db from here everywhere — never create a second client

import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { drizzle } from "drizzle-orm/neon-serverless";
import { env } from "@/lib/env";
import * as schema from "@/lib/db/schema";

// Explicitly set WebSocket constructor — required for Node.js runtime compatibility
neonConfig.webSocketConstructor = ws;

// Pool-based client — supports transactions unlike neon-http
const pool = new Pool({ connectionString: env.databaseUrl });

// Drizzle instance with full schema — gives us type-safe query builder
export const db = drizzle(pool, { schema });

// Re-export schema for convenience — import { db, orgs, chunks } from "@/lib/db"
export * from "@/lib/db/schema";
