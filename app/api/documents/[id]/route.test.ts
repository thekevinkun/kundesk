// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  requireOrgAdmin: vi.fn(),
  limit: vi.fn(),
  transaction: vi.fn(),
  txWhere: vi.fn(),
  deleteFromStorage: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireOrgAdmin: m.requireOrgAdmin }));
vi.mock("drizzle-orm", () => ({
  and: (...a: unknown[]) => ({ and: a }),
  eq: (c: unknown, v: unknown) => ({ eq: [c, v] }),
}));
vi.mock("@/lib/db/schema", () => ({
  documents: { id: "documents.id", orgId: "documents.orgId" },
  chunks: { documentId: "chunks.documentId", orgId: "chunks.orgId" },
}));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: m.limit }) }) }),
    transaction: m.transaction,
  },
}));
vi.mock("@/lib/aws/s3", () => ({ deleteFromStorage: m.deleteFromStorage }));

import { DELETE } from "./route";

const call = (id: string) =>
  DELETE(
    new NextRequest(`http://localhost/api/documents/${id}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id }) },
  );

describe("DELETE /api/documents/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.requireOrgAdmin.mockResolvedValue({ orgId: "org_a" });
    m.limit.mockResolvedValue([
      { id: 5, s3Key: "orgs/org_a/documents/1-x.txt" },
    ]);
    m.deleteFromStorage.mockResolvedValue(undefined);
    m.txWhere.mockResolvedValue(undefined);
    // The transaction runs its callback with a fake handle
    m.transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<void>) =>
        fn({ delete: () => ({ where: m.txWhere }) }),
    );
  });

  it("rejects a non-admin before touching anything", async () => {
    m.requireOrgAdmin.mockRejectedValue(new Error("Forbidden"));

    await expect(call("5")).rejects.toThrow("Forbidden");
    expect(m.deleteFromStorage).not.toHaveBeenCalled();
    expect(m.transaction).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric id with 400", async () => {
    expect((await call("abc")).status).toBe(400);
    expect(m.deleteFromStorage).not.toHaveBeenCalled();
  });

  it("answers 404 for a missing or foreign document and deletes nothing", async () => {
    m.limit.mockResolvedValue([]);

    expect((await call("5")).status).toBe(404);
    expect(m.deleteFromStorage).not.toHaveBeenCalled();
    expect(m.transaction).not.toHaveBeenCalled();
  });

  it("deletes the stored file, then the chunks and the document row", async () => {
    const res = await call("5");

    expect(res.status).toBe(204);
    expect(m.deleteFromStorage).toHaveBeenCalledWith(
      "orgs/org_a/documents/1-x.txt",
    );
    expect(m.transaction).toHaveBeenCalledTimes(1);
    // chunks delete + document delete
    expect(m.txWhere).toHaveBeenCalledTimes(2);
    // The file goes first, so a storage failure never leaves a half-deleted document.
    // The fallbacks make the check fail if either call never happened.
    const fileOrder =
      m.deleteFromStorage.mock.invocationCallOrder[0] ??
      Number.POSITIVE_INFINITY;
    const dbOrder =
      m.transaction.mock.invocationCallOrder[0] ?? Number.NEGATIVE_INFINITY;
    expect(fileOrder).toBeLessThan(dbOrder);
  });

  it("answers 500 and keeps the database rows when storage fails", async () => {
    m.deleteFromStorage.mockRejectedValue(new Error("timeout"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await call("5");

    expect(res.status).toBe(500);
    expect(m.transaction).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("still deletes the rows when the file is already gone", async () => {
    m.deleteFromStorage.mockRejectedValue(
      Object.assign(new Error("NotFound"), { name: "NotFound" }),
    );

    const res = await call("5");

    expect(res.status).toBe(204);
    expect(m.transaction).toHaveBeenCalledTimes(1);
  });
});
