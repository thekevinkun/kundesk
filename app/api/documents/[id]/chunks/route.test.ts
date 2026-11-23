// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({
  requireOrg: vi.fn(),
  select: vi.fn(),
  docLimit: vi.fn(),
  chunkLimit: vi.fn(),
  offset: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireOrg: m.requireOrg }));
vi.mock("drizzle-orm", () => ({
  and: (...a: unknown[]) => ({ and: a }),
  eq: (c: unknown, v: unknown) => ({ eq: [c, v] }),
  asc: (c: unknown) => ({ asc: c }),
}));
vi.mock("@/lib/db/schema", () => ({
  documents: { id: "documents.id", orgId: "documents.orgId" },
  chunks: {
    id: "chunks.id",
    content: "chunks.content",
    documentId: "chunks.documentId",
    orgId: "chunks.orgId",
  },
}));
vi.mock("@/lib/db", () => ({ db: { select: m.select } }));

import { GET } from "./route";

const call = (id: string, query = "") =>
  GET(new NextRequest(`http://localhost/api/documents/${id}/chunks${query}`), {
    params: Promise.resolve({ id }),
  });

const makeRows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, content: `c${i + 1}` }));

describe("GET /api/documents/[id]/chunks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.requireOrg.mockResolvedValue({ orgId: "org_a" });
    m.docLimit.mockResolvedValue([{ id: 5 }]);
    m.offset.mockResolvedValue(makeRows(3));
    // First select() = the document check, second select() = the chunks page
    m.select
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: m.docLimit }) }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: (n: number) => {
                m.chunkLimit(n);
                return { offset: m.offset };
              },
            }),
          }),
        }),
      });
  });

  it("rejects a non-numeric id with 400", async () => {
    expect((await call("abc")).status).toBe(400);
  });

  it.each(["0", "-1", "1.5", "abc", "99999"])(
    "rejects page=%s with 400",
    async (page) => {
      const res = await call("5", `?page=${page}`);
      expect(res.status).toBe(400);
      expect(m.docLimit).not.toHaveBeenCalled();
    },
  );

  it("answers 404 for a missing or foreign document and reads no chunks", async () => {
    m.docLimit.mockResolvedValue([]);
    const res = await call("5");
    expect(res.status).toBe(404);
    expect(m.offset).not.toHaveBeenCalled();
  });

  it("returns the first page with hasMore=false when there is no extra row", async () => {
    const json = await (await call("5")).json();
    expect(json.data.page).toBe(1);
    expect(json.data.hasMore).toBe(false);
    expect(json.data.chunks).toHaveLength(3);
    expect(m.offset).toHaveBeenCalledWith(0);
  });

  it("asks for 21 rows and returns 20 with hasMore=true when an extra row exists", async () => {
    m.offset.mockResolvedValue(makeRows(21));
    const json = await (await call("5")).json();
    expect(m.chunkLimit).toHaveBeenCalledWith(21);
    expect(json.data.chunks).toHaveLength(20);
    expect(json.data.hasMore).toBe(true);
  });

  it("skips 20 rows per page", async () => {
    await call("5", "?page=3");
    expect(m.offset).toHaveBeenCalledWith(40);
  });
});
