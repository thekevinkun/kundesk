// Tests the document upload pipeline — authenticated dashboard route
// Calls upload + process APIs directly — faster and more reliable than UI file picker
// Verifies: document appears in list, status changes from processing → ready

import { test, expect } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

test.describe("Document upload", () => {
  // Scoped outside the test so afterEach can reach it even if an assertion
  // above throws mid-test — cleanup must run regardless of pass/fail, or
  // leftover rows silently accumulate until they cross the plan's document
  // limit and start failing unrelated future runs with a 403.
  let createdDocumentId: number | null = null;

  test.afterEach(async ({ page }) => {
    if (createdDocumentId !== null) {
      await page.evaluate(async (id) => {
        await fetch(`/api/documents/${id}`, { method: "DELETE" });
      }, createdDocumentId);
      createdDocumentId = null;
    }
  });

  test("uploads a document and shows it in the list", async ({ page }) => {
    test.setTimeout(60_000);

    await setupClerkTestingToken({ page });

    await page.goto("/dashboard/knowledge");
    await page.waitForURL(/\/dashboard\/knowledge/, { timeout: 15_000 });

    // Profil is the default tab now — switch to Dokumen before asserting
    await page.getByRole("tab", { name: "Dokumen" }).click();

    await expect(page.getByLabel("Daftar dokumen")).toBeVisible({
      timeout: 10_000,
    });

    // Unique filename — prevents strict mode violation from previous test runs
    const filename = `test-faq-${Date.now()}.txt`;

    // Step 1 — get presigned URL
    const uploadRes = await page.evaluate(async (filename) => {
      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename,
          contentType: "text/plain",
          fileSize: 1024,
        }),
      });
      return res.json() as Promise<{
        ok: boolean;
        data?: { uploadUrl: string; s3Key: string; documentId: number };
      }>;
    }, filename);

    expect(uploadRes.ok).toBe(true);
    expect(uploadRes.data?.documentId).toBeDefined();
    expect(uploadRes.data?.s3Key).toBeDefined();

    const { uploadUrl, s3Key, documentId } = uploadRes.data!;

    // Capture immediately — afterEach needs this even if a later assertion
    // in this test throws before reaching the end
    createdDocumentId = documentId;

    // Step 2 — PUT file content
    await page.evaluate(
      async ({ uploadUrl }) => {
        await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "text/plain" },
          body: "Ini adalah FAQ test.\n\nQ: Apa itu Kundesk?\nA: Platform AI customer service.",
        });
      },
      { uploadUrl },
    );

    // Step 3 — trigger processing
    const processRes = await page.evaluate(
      async ({ documentId, s3Key }) => {
        const res = await fetch("/api/documents/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId, s3Key }),
        });
        return res.json() as Promise<{
          ok: boolean;
          data?: { chunkCount: number };
        }>;
      },
      { documentId, s3Key },
    );

    expect(processRes.ok).toBe(true);
    expect(processRes.data?.chunkCount).toBeGreaterThan(0);

    // Step 4 — reload and verify
    await page.goto("/dashboard/knowledge");
    await page.waitForURL(/\/dashboard\/knowledge/, { timeout: 10_000 });

    // Fresh navigation resets to the default (Profil) tab — switch back
    await page.getByRole("tab", { name: "Dokumen" }).click();

    // Use first() — multiple uploads from prev runs may exist, we just need ours
    await expect(page.getByText(filename).first()).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.getByText("Ready").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("shows upload zone on documents page", async ({ page }) => {
    await setupClerkTestingToken({ page });

    await page.goto("/dashboard/knowledge");
    await page.waitForURL(/\/dashboard\/knowledge/, { timeout: 15_000 });

    // Profil is the default tab — switch to Dokumen first
    await page.getByRole("tab", { name: "Dokumen" }).click();

    // Upload zone must be visible with correct aria-label
    await expect(page.getByLabel(/Upload dokumen/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("rejects invalid file type via API", async ({ page }) => {
    await setupClerkTestingToken({ page });

    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    // Try to upload an unsupported file type
    const res = await page.evaluate(async () => {
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "malware.exe",
          contentType: "application/octet-stream",
          fileSize: 1024,
        }),
      });
      return {
        ok: response.ok,
        error: await response.text(),
      };
    });

    // Should be rejected — exe is not an allowed file type
    expect(res.ok).toBe(false);
    expect(res.error).toBeDefined();
  });
});
