// Drizzle Kit configuration — used by CLI for migrations
// Run: npx drizzle-kit generate → creates SQL migration files
// Run: npx drizzle-kit migrate → applies migrations to Neon

import { defineConfig } from "drizzle-kit"
import { env } from "@/lib/env"

export default defineConfig({
  // PostgreSQL dialect — Neon is serverless PostgreSQL
  dialect: "postgresql",

  // Single schema file — all tables defined here
  schema: "./lib/db/schema.ts",

  // Migration output folder
  out: "./lib/db/migrations",

  // Neon connection string from env
  dbCredentials: {
    url: env.databaseUrl,
  },
})
