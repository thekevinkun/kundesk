// Drizzle ORM client — connected to Neon serverless PostgreSQL
// Uses neon serverless with WebSocket driver — supports transactions
// Import db from here everywhere — never create a second client

import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { env } from "@/lib/env";
import * as schema from "@/lib/db/schema";

// Pool-based client — supports transactions unlike neon-http
const pool = new Pool({ connectionString: env.databaseUrl });

// Drizzle instance with full schema — gives us type-safe query builder
export const db = drizzle(pool, { schema });

// Re-export schema for convenience — import { db, orgs, chunks } from "@/lib/db"
export * from "@/lib/db/schema";
