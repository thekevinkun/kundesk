// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  requireOrg: vi.fn(),
  limit: vi.fn(),
  getS3ObjectSize: vi.fn(),
  generatePresignedDownloadUrl: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireOrg: m.requireOrg }));
vi.mock("drizzle-orm", () => ({
  and: (...a: unknown[]) => ({ and: a }),
  eq: (c: unknown, v: unknown) => ({ eq: [c, v] }),
}));
vi.mock("@/lib/db/schema", () => ({
  documents: { id: "id", orgId: "orgId" },
}));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: m.limit }) }) }),
  },
}));
vi.mock("@/lib/aws/s3", () => ({
  getS3ObjectSize: m.getS3ObjectSize,
  generatePresignedDownloadUrl: m.generatePresignedDownloadUrl,
}));

import { GET } from "./route";

const call = (id: string, query = "") =>
  GET(new NextRequest(`http://localhost/api/documents/${id}/file${query}`), {
    params: Promise.resolve({ id }),
  });

describe("GET /api/documents/[id]/file", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.requireOrg.mockResolvedValue({ orgId: "org_a" });
    m.limit.mockResolvedValue([
      { id: 5, s3Key: "orgs/a/1-x.pdf", name: "x.pdf" },
    ]);
    m.getS3ObjectSize.mockResolvedValue(100);
    m.generatePresignedDownloadUrl.mockResolvedValue(
      "https://signed.example/f",
    );
  });

  it("rejects a non-numeric id with 400", async () => {
    const res = await call("abc");
    expect(res.status).toBe(400);
    expect(m.limit).not.toHaveBeenCalled();
  });

  it("answers 404 for a missing or foreign document", async () => {
    m.limit.mockResolvedValue([]);
    const res = await call("5");
    expect(res.status).toBe(404);
    expect(m.generatePresignedDownloadUrl).not.toHaveBeenCalled();
  });

  it("returns an inline link by default", async () => {
    const res = await call("5");
    expect(await res.json()).toEqual({
      ok: true,
      data: { available: true, url: "https://signed.example/f" },
    });
    expect(m.generatePresignedDownloadUrl).toHaveBeenCalledWith(
      "orgs/a/1-x.pdf",
      "x.pdf",
      "inline",
    );
  });

  it("returns an attachment link for mode=download", async () => {
    await call("5", "?mode=download");
    expect(m.generatePresignedDownloadUrl).toHaveBeenCalledWith(
      "orgs/a/1-x.pdf",
      "x.pdf",
      "attachment",
    );
  });

  it("says unavailable when the file no longer exists, without making a link", async () => {
    m.getS3ObjectSize.mockRejectedValue(new Error("NotFound"));
    const res = await call("5");
    expect(await res.json()).toEqual({ ok: true, data: { available: false } });
    expect(m.generatePresignedDownloadUrl).not.toHaveBeenCalled();
  });

  it("says unavailable in mock mode (no link)", async () => {
    m.generatePresignedDownloadUrl.mockResolvedValue(null);
    const res = await call("5");
    expect(await res.json()).toEqual({ ok: true, data: { available: false } });
  });

  it("answers 500 when the link cannot be made", async () => {
    m.generatePresignedDownloadUrl.mockRejectedValue(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call("5");
    expect(res.status).toBe(500);
    spy.mockRestore();
  });
});
