// Covers the three cases deferred from Phase 17 Session 1 (kundesk-phase-
// handoff.md rule 14's "next up" list): the knowledge entry plan limit,
// org isolation, and the orphaned-summary-chunk check on deleting a
// catalog section's last entry.
//
// Departs from this suite's usual page.evaluate(fetch(...)) pattern:
// knowledge mutations are Server Actions, not REST routes like
// /api/documents/*, so there's no endpoint to seed data through or invoke
// directly. This file instead:
//   1. Imports db + schema directly into the Node-context test body for
//      fixture setup/teardown and for asserting internal state (chunk
//      rows) that has no UI surface — new to this suite, first use here.
//   2. Drives real UI clicks wherever the actual sync layer (embedding)
//      must run for real (Test 3) — a DB-seeded fixture can't fake that.
//
// NOT covered: cross-org WRITE rejection (org A calling deleteSection on
// org B's row) — would need a REST layer or Server-Action test harness for
// these actions, neither of which exists. What IS covered: read-side
// isolation (a foreign org's section never appears in the list), the same
// bug class the codebase's own core rule targets.

import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chunks, knowledgeEntries, knowledgeSections } from "@/lib/db/schema";

const ORG_ID = process.env.E2E_ORG_ID!;

// PLAN_LIMITS.free.knowledgeEntries, kept as a literal rather than imported
// — pulling types/billing.ts into this Node-context file for one number
// isn't worth it. Update this if the Free plan's limit ever changes.
const FREE_PLAN_ENTRY_LIMIT = 50;

test.describe("Knowledge — plan limit, org isolation, orphan chunks", () => {
  // ─── Plan limit ───
  test.describe("entry plan limit", () => {
    let tempSectionId: number | null = null;

    test.afterEach(async () => {
      if (tempSectionId !== null) {
        // Cascades to entries, entries cascade to their chunks
        await db
          .delete(knowledgeSections)
          .where(eq(knowledgeSections.id, tempSectionId));
        tempSectionId = null;
      }
    });

    test("shows the limit banner and disables 'Tambah entri' at the plan cap", async ({
      page,
    }) => {
      test.setTimeout(30_000);

      // Never assume the org starts at 0 — other tests/manual use may
      // have left real entries behind
      const [currentCountRow] = await db
        .select({ total: count() })
        .from(knowledgeEntries)
        .where(eq(knowledgeEntries.orgId, ORG_ID));

      const currentCount = currentCountRow?.total ?? 0;

      const fillerNeeded = Math.max(0, FREE_PLAN_ENTRY_LIMIT - currentCount);

      const [section] = await db
        .insert(knowledgeSections)
        .values({
          orgId: ORG_ID,
          kind: "catalog",
          title: "E2E Limit Test",
          sortOrder: 9999,
        })
        .returning({ id: knowledgeSections.id });
      tempSectionId = section!.id;

      if (fillerNeeded > 0) {
        // Direct insert, not 49 dialog submissions — this test targets the
        // limit-enforcement mechanism, not entry-creation UX (already
        // exercised by manual QA on the section/entry management PR)
        await db.insert(knowledgeEntries).values(
          Array.from({ length: fillerNeeded }, (_, i) => ({
            orgId: ORG_ID,
            sectionId: tempSectionId!,
            title: `E2E filler ${i}`,
            body: "",
            isAvailable: true,
            sortOrder: i,
            // "synced" so this test's fixtures don't trip the unrelated
            // stale-sync banner
            syncStatus: "synced" as const,
          })),
        );
      }

      await setupClerkTestingToken({ page });
      await page.goto("/dashboard/knowledge");
      await page.waitForURL(/\/dashboard\/knowledge/, { timeout: 15_000 });
      await page.getByRole("tab", { name: "Katalog & FAQ" }).click();

      // Proves the real DB count reached the plan's actual limit
      await expect(
        page.getByText(
          `${FREE_PLAN_ENTRY_LIMIT} / ${FREE_PLAN_ENTRY_LIMIT} entri`,
        ),
      ).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText("Batas entri tercapai")).toBeVisible();

      await page.getByText("E2E Limit Test").click(); // expand
      await expect(
        page.getByRole("button", { name: "+ Tambah entri" }),
      ).toBeDisabled();
    });
  });

  // ─── Read-side org isolation ───
  test.describe("org isolation", () => {
    const foreignOrgId = `e2e-foreign-org-${Date.now()}`;
    let foreignSectionId: number | null = null;

    test.afterEach(async () => {
      if (foreignSectionId !== null) {
        await db
          .delete(knowledgeSections)
          .where(eq(knowledgeSections.id, foreignSectionId));
        foreignSectionId = null;
      }
    });

    test("never shows another org's section in the list", async ({ page }) => {
      const uniqueTitle = `E2E Foreign Section ${Date.now()}`;

      // No second Clerk org needed — this targets the read query's own
      // org-scoping, not a full second authenticated session
      const [section] = await db
        .insert(knowledgeSections)
        .values({
          orgId: foreignOrgId,
          kind: "note",
          title: uniqueTitle,
          sortOrder: 0,
        })
        .returning({ id: knowledgeSections.id });
      foreignSectionId = section!.id;

      await setupClerkTestingToken({ page });
      await page.goto("/dashboard/knowledge");
      await page.waitForURL(/\/dashboard\/knowledge/, { timeout: 15_000 });
      await page.getByRole("tab", { name: "Katalog & FAQ" }).click();

      // A brief settle so an empty list at t=0 can't make this pass vacuously
      await page.waitForTimeout(1000);

      await expect(page.getByText(uniqueTitle)).not.toBeVisible();
    });
  });

  // ─── Orphaned summary chunk on last-entry deletion ───
  test.describe("orphaned summary chunk", () => {
    let tempSectionId: number | null = null;

    test.afterEach(async () => {
      if (tempSectionId !== null) {
        await db.delete(chunks).where(eq(chunks.sectionId, tempSectionId));
        await db
          .delete(knowledgeSections)
          .where(eq(knowledgeSections.id, tempSectionId));
        tempSectionId = null;
      }
    });

    test("leaves no summary chunk after deleting a catalog section's last entry", async ({
      page,
    }) => {
      test.setTimeout(60_000);

      await setupClerkTestingToken({ page });
      await page.goto("/dashboard/knowledge");
      await page.waitForURL(/\/dashboard\/knowledge/, { timeout: 15_000 });
      await page.getByRole("tab", { name: "Katalog & FAQ" }).click();

      const sectionTitle = `E2E Orphan Test ${Date.now()}`;

      // Real UI flow, not a DB seed — the summary chunk this test checks
      // for is only ever created by the real sync layer, which only runs
      // inside the actual Server Actions
      await page.getByRole("button", { name: "+ Tambah bagian" }).click();
      await page.getByLabel("Nama bagian").fill(sectionTitle);
      await page.getByRole("button", { name: "Simpan" }).click();
      await expect(page.getByText("Bagian ditambahkan")).toBeVisible({
        timeout: 10_000,
      });

      await page.getByText(sectionTitle).click(); // expand

      // Two entries — a summary chunk only exists for 2+ entries (rule 174)
      for (const title of ["E2E Item A", "E2E Item B"]) {
        await page.getByRole("button", { name: "+ Tambah entri" }).click();
        await page.getByLabel("Judul entri").fill(title);
        await page.getByRole("button", { name: "Simpan" }).click();
        await expect(page.getByText("Entri ditambahkan")).toBeVisible({
          timeout: 15_000,
        });
      }

      const [section] = await db
        .select({ id: knowledgeSections.id })
        .from(knowledgeSections)
        .where(
          and(
            eq(knowledgeSections.orgId, ORG_ID),
            eq(knowledgeSections.title, sectionTitle),
          ),
        )
        .limit(1);
      tempSectionId = section!.id;

      // Sanity check before deleting — a false "no orphan" pass shouldn't
      // hide a summary that was never created in the first place
      const [summaryBeforeRow] = await db
        .select({ total: count() })
        .from(chunks)
        .where(
          and(eq(chunks.sectionId, tempSectionId), eq(chunks.orgId, ORG_ID)),
        );

      const summaryBefore = summaryBeforeRow?.total ?? 0;

      expect(summaryBefore).toBeGreaterThan(0);

      // "The last entry", literally — delete down to zero
      for (const title of ["E2E Item A", "E2E Item B"]) {
        await page.getByRole("button", { name: `Hapus ${title}` }).click();
        await page.getByRole("button", { name: "Hapus", exact: true }).click();
        await expect(page.getByText("Entri dihapus")).toBeVisible({
          timeout: 10_000,
        });
      }

      // The real assertion — no UI shows this, checked directly against
      // the chunks table
      const [summaryAfterRow] = await db
        .select({ total: count() })
        .from(chunks)
        .where(
          and(eq(chunks.sectionId, tempSectionId), eq(chunks.orgId, ORG_ID)),
        );

      const summaryAfter = summaryAfterRow?.total ?? 0;

      expect(summaryAfter).toBe(0);
    });
  });
});
