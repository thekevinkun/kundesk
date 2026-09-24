// Covers the three cases deferred from Phase 17 Session 1 (kundesk-phase-
// handoff.md rule 14's "next up" list): the knowledge entry plan limit,
// org isolation, and the orphaned-summary-chunk check on deleting a
// catalog section's last entry.
//
// Departs from this suite's usual page.evaluate(fetch(...)) pattern:
// knowledge mutations are Server Actions, not REST routes, and can't be
// invoked directly from this Node test context either (requireOrgAdmin()
// needs Clerk's request-scoped auth() context, unavailable outside a real
// request). This file instead imports db + schema directly for fixture
// setup/teardown and for asserting internal state (chunk rows) that has
// no UI surface, and drives real UI clicks for anything that must go
// through the actual sync layer.
//
// NOT covered: cross-org WRITE rejection (org A calling deleteSection on
// org B's row) — would need a REST layer or Server-Action test harness for
// these actions, neither of which exists. What IS covered: read-side
// isolation (a foreign org's section never appears in the list).

import { test, expect, type Page } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  chunks,
  knowledgeEntries,
  knowledgeSections,
  orgs,
} from "@/lib/db/schema";
import { getOrgPlan } from "@/lib/db/queries/knowledge";
import { PLAN_LIMITS } from "@/types/billing";

const ORG_ID = process.env.E2E_ORG_ID!;

// Polls the DB directly for a section's own entries going stale->synced,
// nudging the app's own "Coba lagi" retry banner if a transient embed
// failure (real OpenAI call in this CI job) left something stale — this
// models the app's documented recovery path (rule 181) rather than
// assuming every sync succeeds on the first try.
async function waitForNoStaleEntries(
  page: Page,
  sectionId: number,
  timeoutMs = 20_000,
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const stale = await db
      .select({ id: knowledgeEntries.id })
      .from(knowledgeEntries)
      .where(
        and(
          eq(knowledgeEntries.sectionId, sectionId),
          eq(knowledgeEntries.syncStatus, "stale"),
        ),
      );

    if (stale.length === 0) return;

    const retryButton = page.getByRole("button", { name: "Coba lagi" });
    if (await retryButton.isVisible().catch(() => false)) {
      await retryButton.click();
      await page.waitForTimeout(2000);
    } else {
      await page.waitForTimeout(1000);
    }
  }

  throw new Error(
    `Section ${sectionId} still has stale entries after ${timeoutMs}ms — ` +
      "sync isn't recovering even via retry. Check Sentry for embed_failed/superseded on this org.",
  );
}

test.describe("Knowledge — plan limit, org isolation, orphan chunks", () => {
  // ─── Plan limit ───
  test.describe("entry plan limit", () => {
    let tempSectionId: number | null = null;

    test.afterEach(async () => {
      if (tempSectionId !== null) {
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

      // Never assume this org's plan — it's a real, shared test org used
      // across many features' manual QA, plausibly on Starter/Pro rather
      // than Free. Read the actual limit instead of hardcoding one.
      const plan = await getOrgPlan(ORG_ID);
      const entryLimit = PLAN_LIMITS[plan].knowledgeEntries;

      // Never assume the org starts at 0 — other tests/manual use may
      // have left real entries behind
      const [currentCountRow] = await db
        .select({ total: count() })
        .from(knowledgeEntries)
        .where(eq(knowledgeEntries.orgId, ORG_ID));
      const currentCount = currentCountRow?.total ?? 0;

      const fillerNeeded = Math.max(0, entryLimit - currentCount);

      // Pro's limit is 1000 — filling that many rows for a UI-behavior
      // test would be excessive and slow. If this org is Pro, skip rather
      // than force a 1000-row fixture just to prove the same enforcement
      // logic Free/Starter already cover.
      test.skip(
        fillerNeeded > 350,
        `Org's plan (${plan}) limit is ${entryLimit} — too large to fixture for this UI test`,
      );

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
        await db.insert(knowledgeEntries).values(
          Array.from({ length: fillerNeeded }, (_, i) => ({
            orgId: ORG_ID,
            sectionId: tempSectionId!,
            title: `E2E filler ${i}`,
            body: "",
            isAvailable: true,
            sortOrder: i,
            syncStatus: "synced" as const,
          })),
        );
      }

      await setupClerkTestingToken({ page });
      await page.goto("/dashboard/knowledge");
      await page.waitForURL(/\/dashboard\/knowledge/, { timeout: 15_000 });
      await page.getByRole("tab", { name: "Katalog & FAQ" }).click();

      // The numerator isn't asserted exactly — this is a real, shared test
      // org, not a clean fixture, so the count could legitimately be >=
      // the limit rather than exactly it. The ENFORCEMENT behavior below
      // is what actually matters and is unambiguous either way.
      await expect(page.getByText(`/ ${entryLimit} entri`)).toBeVisible({
        timeout: 10_000,
      });
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
        // Deleting the org cascades to its section (onDelete: cascade on
        // knowledgeSections.orgId) — one delete instead of two
        await db.delete(orgs).where(eq(orgs.id, foreignOrgId));
        foreignSectionId = null;
      }
    });

    test("never shows another org's section in the list", async ({ page }) => {
      const uniqueTitle = `E2E Foreign Section ${Date.now()}`;

      // knowledgeSections.orgId has a real FK to orgs.id — a made-up
      // string ID fails at insert, not at read time, so a real orgs row
      // is required. No second Clerk org/session needed — this targets
      // the read query's own org-scoping, not a full authenticated flow.
      await db.insert(orgs).values({
        id: foreignOrgId,
        slug: `e2e-foreign-${Date.now()}`,
        name: "E2E Foreign Org",
      });

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
      test.setTimeout(90_000); // higher than the document-upload test's 60s — this does 2 real syncs + a possible retry loop

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

      // A toast only proves the entry ROW was created, not that its sync
      // succeeded — an entry can be created but left "stale" if the embed
      // call failed (rule 181's designed recovery path). Confirm real
      // sync state directly, and use the app's own retry banner if needed,
      // rather than assuming the toast means the summary chunk exists.
      await waitForNoStaleEntries(page, tempSectionId);

      // Force a full section resync before checking for the summary chunk.
      // waitForNoStaleEntries only confirms ENTRY-level syncStatus, but
      // syncEntry's per-entry sync path does an unlocked re-read of the
      // section's entries before embedding — possible (not fully
      // confirmed) timing gap where a summary built right as the 2nd
      // entry lands doesn't see both rows yet, leaving entries "synced"
      // but no summary chunk. updateSection's real-change path flags
      // every entry stale and does a full locked resync (syncSection,
      // scope "all"), which is the most robust rebuild path available —
      // using it here so the test measures the actual before/after
      // guarantee instead of a possible race. Worth a real look at
      // syncSectionChunks's read timing separately from this test.
      await page.getByRole("button", { name: "Edit bagian" }).click();
      await page
        .getByLabel("Catatan bagian")
        .fill(`forced resync ${Date.now()}`);
      await page.getByRole("button", { name: "Simpan" }).click();
      await expect(page.getByText("Bagian diperbarui")).toBeVisible({
        timeout: 10_000,
      });
      await waitForNoStaleEntries(page, tempSectionId);

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
