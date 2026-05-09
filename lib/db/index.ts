// Drizzle ORM client — connected to Neon serverless PostgreSQL
// Uses @neondatabase/serverless driver — HTTP-based, works in edge/serverless
// Import db from here everywhere — never create a second client

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/lib/env";
import * as schema from "@/lib/db/schema";

// Neon HTTP client — serverless-compatible, no persistent connections
const sql = neon(env.databaseUrl);

// Drizzle instance with full schema — gives us type-safe query builder
export const db = drizzle(sql, { schema });

// Re-export schema for convenience — import { db, orgs, chunks } from "@/lib/db"
export * from "@/lib/db/schema";
