// Tests for POST /api/documents/process — the processing pipeline after an upload.
// Focus of this file: the real-size and real-content checks, plus the main success and failure
// paths. SQL behaviour cannot be verified with mocks (rule 262) — these pin control flow and payloads.
// Only .txt / .md bodies reach the parser here, so the pdf-parse and OCR paths are not exercised.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { MAX_FILE_SIZE_BYTES } from "@/helpers/security";
import {
  BINARY_TEXT_MESSAGE,
  SIGNATURE_MISMATCH_MESSAGE,
} from "@/helpers/file-signature";
import { POST } from "./route";

// Hoisted so the vi.mock factories below can reference them (rule 163)
const m = vi.hoisted(() => ({
  requireOrgAdmin: vi.fn(),
  uploadLimit: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  updateSet: vi.fn(),
  insertValues: vi.fn(),
  deleteChunks: vi.fn(),
  updateWhere: vi.fn(),
  downloadFromS3: vi.fn(),
  getS3ObjectSize: vi.fn(),
  embedText: vi.fn(),
  chunkText: vi.fn(),
  batchedAsync: vi.fn(),
  triggerDocumentUpdated: vi.fn(),
  trackEvent: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

// Mutable state the fakes read
const state = vi.hoisted(() => ({
  // What the row lock in the storing transaction reads: a status, or null = no such row
  lockedStatus: "processing" as string | null,
  // Rows markFailed's guarded UPDATE reports as changed ([] = the document was no longer "processing")
  failedRows: [{ id: 5 }] as Array<{ id: number }>,
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: m.captureException,
  captureMessage: m.captureMessage,
}));
vi.mock("@/lib/db", () => ({
  db: { select: m.select, update: m.update, transaction: m.transaction },
}));
vi.mock("@/lib/env", () => ({
  env: { aiMode: "mock", openaiApiKey: "sk-test" },
}));
vi.mock("@/lib/auth", () => ({ requireOrgAdmin: m.requireOrgAdmin }));
vi.mock("@/lib/posthog", () => ({ trackEvent: m.trackEvent }));
vi.mock("@/lib/ai/embed", () => ({ embedText: m.embedText }));
vi.mock("@/helpers/chunk", () => ({ chunkText: m.chunkText }));
vi.mock("@/helpers/async", () => ({ batchedAsync: m.batchedAsync }));
vi.mock("@/lib/aws/s3", () => ({
  downloadFromS3: m.downloadFromS3,
  getS3ObjectSize: m.getS3ObjectSize,
}));
vi.mock("@/lib/redis", () => ({ checkUploadRateLimit: m.uploadLimit }));
vi.mock("@/lib/pusher", () => ({
  triggerDocumentUpdated: m.triggerDocumentUpdated,
}));
// Operators become plain data; columns are just their own names
vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ op: "and", args }),
  eq: (a: unknown, b: unknown) => ({ op: "eq", a, b }),
}));
vi.mock("@/lib/db/schema", () => ({
  documents: {
    id: "documents.id",
    orgId: "documents.orgId",
    status: "documents.status",
  },
  chunks: { orgId: "chunks.orgId", documentId: "chunks.documentId" },
}));

type Row = Record<string, unknown>;

const S3_KEY = "orgs/org_a/documents/1-menu.txt";
const DOC = {
  id: 5,
  orgId: "org_a",
  name: "menu.txt",
  s3Key: S3_KEY,
  status: "processing",
};
const VALID_BODY = { documentId: 5, s3Key: S3_KEY };
const TEXT = "Menu hari ini: nasi goreng";

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/documents/process", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// db.select().from().where().limit() — the document lookup
function queueDocument(row: Row | null): void {
  m.select.mockReturnValueOnce({
    from: () => ({
      where: () => ({ limit: () => Promise.resolve(row ? [row] : []) }),
    }),
  });
}

async function readJson(res: Response): Promise<Row> {
  return (await res.json()) as Row;
}

// The fake transaction handle: the row lock, the chunk delete and insert, and the ready update
const tx = {
  select: () => ({
    from: () => ({
      where: () => ({
        for: () =>
          Promise.resolve(
            state.lockedStatus === null ? [] : [{ status: state.lockedStatus }],
          ),
      }),
    }),
  }),
  delete: () => ({
    where: () => {
      m.deleteChunks();
      return Promise.resolve(undefined);
    },
  }),
  insert: () => ({
    values: (values: unknown) => {
      m.insertValues(values);
      return Promise.resolve(undefined);
    },
  }),
  update: () => ({
    set: (values: Row) => {
      m.updateSet(values);
      return { where: () => Promise.resolve(undefined) };
    },
  }),
};

// The failure side effects every failed document must have
function expectMarkedFailed(): void {
  expect(m.updateSet).toHaveBeenCalledWith({ status: "failed" });
  expect(m.triggerDocumentUpdated).toHaveBeenCalledWith("org_a", {
    documentId: 5,
    status: "failed",
    chunkCount: 0,
  });
}

describe("POST /api/documents/process", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Happy defaults
    m.requireOrgAdmin.mockResolvedValue({ orgId: "org_a" });
    state.lockedStatus = "processing";
    state.failedRows = [{ id: 5 }];
    m.uploadLimit.mockResolvedValue({ success: true, remaining: 9, reset: 0 });
    queueDocument(DOC);
    m.getS3ObjectSize.mockResolvedValue(1000);
    m.downloadFromS3.mockResolvedValue(Buffer.from(TEXT));
    m.chunkText.mockReturnValue([{ content: TEXT }]);
    m.embedText.mockResolvedValue([0.1, 0.2]);
    // Embedding in batches is covered elsewhere — here every item is just embedded
    m.batchedAsync.mockImplementation(
      async (
        items: unknown[],
        _size: number,
        fn: (item: unknown) => Promise<unknown>,
      ) => Promise.all(items.map(fn)),
    );
    m.triggerDocumentUpdated.mockResolvedValue(undefined);

    // markFailed's guarded UPDATE ... RETURNING
    m.update.mockImplementation(() => ({
      set: (values: Row) => {
        m.updateSet(values);
        return {
          where: (arg: unknown) => {
            m.updateWhere(arg);
            return { returning: () => Promise.resolve(state.failedRows) };
          },
        };
      },
    }));
    // The storing transaction runs its callback with the fake handle
    m.transaction.mockImplementation(
      async (callback: (handle: typeof tx) => Promise<unknown>) => callback(tx),
    );
  });

  describe("request checks", () => {
    it("answers 429 when the upload limit is reached, before reading the body", async () => {
      m.uploadLimit.mockResolvedValueOnce({
        success: false,
        remaining: 0,
        reset: 0,
      });

      const res = await POST(postReq(VALID_BODY));

      expect(res.status).toBe(429);
      expect(m.select).not.toHaveBeenCalled();
    });

    it.each([
      ["a missing documentId", { s3Key: S3_KEY }],
      ["a documentId that is not a number", { documentId: "5", s3Key: S3_KEY }],
      ["a missing s3Key", { documentId: 5 }],
      ["an empty s3Key", { documentId: 5, s3Key: "" }],
      ["an s3Key containing ..", { documentId: 5, s3Key: "orgs/../x" }],
      [
        "an s3Key over 500 characters",
        { documentId: 5, s3Key: "a".repeat(501) },
      ],
    ])("answers 400 for %s", async (_label, body) => {
      const res = await POST(postReq(body));

      expect(res.status).toBe(400);
      expect(m.select).not.toHaveBeenCalled();
    });

    it("answers 404 when the document is missing or belongs to another org", async () => {
      m.select.mockReset();
      queueDocument(null);

      const res = await POST(postReq(VALID_BODY));

      expect(res.status).toBe(404);
      expect(m.getS3ObjectSize).not.toHaveBeenCalled();
    });

    it("answers 400 and alerts Sentry when the client s3Key differs from the stored one", async () => {
      const res = await POST(
        postReq({ documentId: 5, s3Key: "orgs/org_b/documents/9-other.txt" }),
      );

      expect(res.status).toBe(400);
      expect(m.captureMessage).toHaveBeenCalledWith(
        "documents/process: s3Key mismatch",
        expect.objectContaining({ level: "error" }),
      );
      expect(m.downloadFromS3).not.toHaveBeenCalled();
    });
  });

  describe("success", () => {
    it("downloads the STORED key, embeds, stores the chunks and marks the document ready", async () => {
      const res = await POST(postReq(VALID_BODY));

      expect(res.status).toBe(200);
      expect(await readJson(res)).toEqual({
        ok: true,
        data: { chunkCount: 1 },
      });
      expect(m.downloadFromS3).toHaveBeenCalledWith(S3_KEY, expect.anything());
      expect(m.deleteChunks).toHaveBeenCalledTimes(1);
      expect(m.insertValues).toHaveBeenCalledWith([
        {
          orgId: "org_a",
          documentId: 5,
          content: TEXT,
          embedding: JSON.stringify([0.1, 0.2]),
        },
      ]);
      expect(m.updateSet).toHaveBeenCalledWith({
        status: "ready",
        chunkCount: 1,
      });
      expect(m.triggerDocumentUpdated).toHaveBeenCalledWith("org_a", {
        documentId: 5,
        status: "ready",
        chunkCount: 1,
      });
      expect(m.trackEvent).toHaveBeenCalledWith("org_a", "document_uploaded", {
        chunk_count: 1,
        file_type: "txt",
      });
    });
  });

  describe("real size check", () => {
    it("fails a file the storage reports as over 10MB, before downloading anything", async () => {
      m.getS3ObjectSize.mockResolvedValue(MAX_FILE_SIZE_BYTES + 1);

      const res = await POST(postReq(VALID_BODY));
      const body = await readJson(res);

      expect(res.status).toBe(500);
      expect(body.error).toBe("Ukuran file maksimal 10MB");
      expect(m.downloadFromS3).not.toHaveBeenCalled();
      expect(m.embedText).not.toHaveBeenCalled();
      expectMarkedFailed();
    });

    it("lets a file of exactly 10MB through", async () => {
      m.getS3ObjectSize.mockResolvedValue(MAX_FILE_SIZE_BYTES);

      const res = await POST(postReq(VALID_BODY));

      expect(res.status).toBe(200);
      expect(m.downloadFromS3).toHaveBeenCalledTimes(1);
    });

    it("asks the storage for the PERSISTED key", async () => {
      await POST(postReq(VALID_BODY));

      expect(m.getS3ObjectSize).toHaveBeenCalledWith(S3_KEY, expect.anything());
    });

    it("fails with a generic message when the size lookup itself fails", async () => {
      m.getS3ObjectSize.mockRejectedValue(new Error("s3 down"));

      const res = await POST(postReq(VALID_BODY));
      const body = await readJson(res);

      expect(res.status).toBe(500);
      // The internal error text never reaches the browser
      expect(body.error).toBe("Terjadi kesalahan saat memproses dokumen.");
      expect(m.downloadFromS3).not.toHaveBeenCalled();
      expectMarkedFailed();
    });

    it("checks the downloaded bytes too, in case the object was replaced after the size check", async () => {
      m.getS3ObjectSize.mockResolvedValue(1000);
      m.downloadFromS3.mockResolvedValue(
        Buffer.alloc(MAX_FILE_SIZE_BYTES + 1, "a"),
      );

      const res = await POST(postReq(VALID_BODY));
      const body = await readJson(res);

      expect(res.status).toBe(500);
      expect(body.error).toBe("Ukuran file maksimal 10MB");
      expect(m.embedText).not.toHaveBeenCalled();
      expectMarkedFailed();
    });
  });

  describe("real content check", () => {
    it("fails an HTML file named .pdf, before parsing or embedding", async () => {
      m.select.mockReset();
      queueDocument({ ...DOC, name: "menu.pdf" });
      m.downloadFromS3.mockResolvedValue(Buffer.from("<html>bukan pdf</html>"));

      const res = await POST(postReq(VALID_BODY));
      const body = await readJson(res);

      expect(res.status).toBe(500);
      expect(body.error).toBe(SIGNATURE_MISMATCH_MESSAGE);
      expect(m.chunkText).not.toHaveBeenCalled();
      expect(m.embedText).not.toHaveBeenCalled();
      expectMarkedFailed();
    });

    it("fails plain text named .docx", async () => {
      m.select.mockReset();
      queueDocument({ ...DOC, name: "menu.docx" });

      const res = await POST(postReq(VALID_BODY));
      const body = await readJson(res);

      expect(body.error).toBe(SIGNATURE_MISMATCH_MESSAGE);
      expect(m.embedText).not.toHaveBeenCalled();
      expectMarkedFailed();
    });

    it("fails a .txt that contains binary bytes with the text-specific message", async () => {
      m.downloadFromS3.mockResolvedValue(Buffer.from("Halo dunia", "utf16le"));

      const res = await POST(postReq(VALID_BODY));
      const body = await readJson(res);

      expect(body.error).toBe(BINARY_TEXT_MESSAGE);
      expect(m.embedText).not.toHaveBeenCalled();
      expectMarkedFailed();
    });
  });

  describe("order of work", () => {
    it("runs: size check → download → chunking → embedding → delete old chunks → insert → mark ready", async () => {
      await POST(postReq(VALID_BODY));

      const order = [
        m.getS3ObjectSize.mock.invocationCallOrder[0],
        m.downloadFromS3.mock.invocationCallOrder[0],
        m.chunkText.mock.invocationCallOrder[0],
        m.embedText.mock.invocationCallOrder[0],
        m.deleteChunks.mock.invocationCallOrder[0],
        m.insertValues.mock.invocationCallOrder[0],
        // On success the first status update is the "ready" one, inside the transaction
        m.updateSet.mock.invocationCallOrder[0],
      ] as number[];
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });
  });

  describe("failures after the checks", () => {
    it("fails an empty document with its own message", async () => {
      m.downloadFromS3.mockResolvedValue(Buffer.from("   \n  "));

      const res = await POST(postReq(VALID_BODY));
      const body = await readJson(res);

      expect(res.status).toBe(500);
      expect(body.error).toBe(
        "Dokumen ini kosong — tidak ada konten yang bisa diproses",
      );
      expectMarkedFailed();
    });

    it("fails with a generic message and alerts Sentry when embedding breaks", async () => {
      const boom = new Error("openai down");
      m.embedText.mockRejectedValue(boom);

      const res = await POST(postReq(VALID_BODY));
      const body = await readJson(res);

      expect(res.status).toBe(500);
      expect(body.error).toBe("Terjadi kesalahan saat memproses dokumen.");
      expect(m.captureException).toHaveBeenCalledWith(expect.any(Error), {
        extra: { orgId: "org_a", documentId: 5 },
      });
      expectMarkedFailed();
    });
  });

  describe("permissions and body", () => {
    it("a non-admin is refused before anything else happens", async () => {
      m.requireOrgAdmin.mockRejectedValueOnce(new Error("Forbidden"));

      await expect(POST(postReq(VALID_BODY))).rejects.toThrow("Forbidden");

      expect(m.uploadLimit).not.toHaveBeenCalled();
      expect(m.select).not.toHaveBeenCalled();
    });

    it("answers 400 for a body that is not JSON", async () => {
      const res = await POST(
        new NextRequest("http://localhost/api/documents/process", {
          method: "POST",
          body: "not json {{",
        }),
      );

      expect(res.status).toBe(400);
      expect(await readJson(res)).toEqual({
        ok: false,
        error: "Format JSON tidak valid",
        status: 400,
      });
      expect(m.select).not.toHaveBeenCalled();
    });
  });

  describe("a document that is not processing", () => {
    it.each(["ready", "failed"])(
      "a %s document answers 409 and costs nothing",
      async (status) => {
        m.select.mockReset();
        queueDocument({ ...DOC, status });

        const res = await POST(postReq(VALID_BODY));
        const body = await readJson(res);

        expect(res.status).toBe(409);
        expect(body.error).toBe(
          "Dokumen ini tidak sedang diproses. Upload ulang file jika perlu.",
        );
        expect(m.getS3ObjectSize).not.toHaveBeenCalled();
        expect(m.downloadFromS3).not.toHaveBeenCalled();
        expect(m.embedText).not.toHaveBeenCalled();
        expect(m.updateSet).not.toHaveBeenCalled();
        expect(m.triggerDocumentUpdated).not.toHaveBeenCalled();
        expect(m.trackEvent).not.toHaveBeenCalled();
      },
    );
  });

  describe("overlapping calls (the storing transaction)", () => {
    it("a call that loses the race answers 409 and writes nothing", async () => {
      // The early check saw "processing", but by the time this call holds the lock another
      // call has already finished the document
      state.lockedStatus = "ready";

      const res = await POST(postReq(VALID_BODY));

      expect(res.status).toBe(409);
      expect(m.deleteChunks).not.toHaveBeenCalled();
      expect(m.insertValues).not.toHaveBeenCalled();
      // A good document is never marked failed, and nobody is told anything
      expect(m.updateSet).not.toHaveBeenCalled();
      expect(m.triggerDocumentUpdated).not.toHaveBeenCalled();
      expect(m.trackEvent).not.toHaveBeenCalled();
      expect(m.captureException).not.toHaveBeenCalled();
    });

    it("a document that vanished before the lock also answers 409", async () => {
      state.lockedStatus = null;

      const res = await POST(postReq(VALID_BODY));

      expect(res.status).toBe(409);
      expect(m.insertValues).not.toHaveBeenCalled();
    });

    it("a failing store is reported, marks the document failed and never marks it ready", async () => {
      m.transaction.mockImplementationOnce(async () => {
        throw new Error("neon down");
      });

      const res = await POST(postReq(VALID_BODY));
      const body = await readJson(res);

      expect(res.status).toBe(500);
      expect(body.error).toBe("Terjadi kesalahan saat memproses dokumen.");
      expect(m.captureException).toHaveBeenCalledTimes(1);
      expect(m.updateSet).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: "ready" }),
      );
      expectMarkedFailed();
    });
  });

  describe("marking a document failed is guarded", () => {
    it("only touches a document that is still processing", async () => {
      m.embedText.mockRejectedValue(new Error("openai down"));

      await POST(postReq(VALID_BODY));

      expect(m.updateWhere).toHaveBeenCalledWith({
        op: "and",
        args: [
          { op: "eq", a: "documents.id", b: 5 },
          { op: "eq", a: "documents.orgId", b: "org_a" },
          { op: "eq", a: "documents.status", b: "processing" },
        ],
      });
    });

    it("sends no 'failed' live event when the document was no longer processing", async () => {
      // Another call already finished this document, so the guarded UPDATE changes no row
      state.failedRows = [];
      m.embedText.mockRejectedValue(new Error("openai down"));

      const res = await POST(postReq(VALID_BODY));

      expect(res.status).toBe(500);
      expect(m.updateSet).toHaveBeenCalledWith({ status: "failed" });
      expect(m.triggerDocumentUpdated).not.toHaveBeenCalled();
    });
  });

  describe("the 55-second timeout", () => {
    it("fails the document with a 408 when the pipeline runs past the limit", async () => {
      // Only the timer functions are faked, so the request body still reads normally
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        // The pipeline never gets past the size lookup
        m.getS3ObjectSize.mockImplementation(
          () => new Promise<number>(() => undefined),
        );

        const pending = POST(postReq(VALID_BODY));
        // vi.waitFor nudges fake timers a little on each check, so this passes once the pipeline started
        await vi.waitFor(() => expect(m.getS3ObjectSize).toHaveBeenCalled());
        await vi.advanceTimersByTimeAsync(55_000);
        const res = await pending;

        expect(res.status).toBe(408);
        expectMarkedFailed();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
