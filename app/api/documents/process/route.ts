// Runs the full document processing pipeline after a successful upload
// parse → chunk → embed → bulk insert into pgvector → update status → Pusher event
// Called by the client immediately after the presigned URL PUT completes

import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireOrg } from "@/lib/auth";
import { embedText } from "@/lib/ai/embed";
import { chunkText } from "@/helpers/chunk";
import { batchedAsync } from "@/helpers/async";
import { downloadFromS3 } from "@/lib/aws/s3";
import { checkUploadRateLimit } from "@/lib/redis";
import { documents, chunks } from "@/lib/db/schema";
import { triggerDocumentUpdated } from "@/lib/pusher";
import type { ApiResponse } from "@/types/api";

// Shape of the request body from the client
interface ProcessRequestBody {
  documentId?: unknown;
  s3Key?: unknown;
}

// Creates a timeout that aborts the controller after ms milliseconds
// AbortController.abort() signals runProcessingPipeline to stop between stages
// Returns a promise that rejects when the timeout fires
function createTimeoutPromise(
  ms: number,
  controller: AbortController,
): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => {
      // Signal the pipeline to stop at the next abort check
      controller.abort();
      reject(new Error(`Processing timed out after ${ms}ms`));
    }, ms),
  );
}

// Runs the full processing pipeline — extracted so it can race against a timeout
// Accepts AbortSignal — checks it between stages so timeout stops work promptly
// Never calls markFailed() directly — outer POST catch owns that side effect
async function runProcessingPipeline(
  orgId: string,
  document: { id: number; name: string },
  s3Key: string,
  signal: AbortSignal,
): Promise<{ textChunks: { content: string }[] }> {
  // ── Stage 1: Download ──
  let fileBuffer: Buffer;
  try {
    // Pass signal so S3 download aborts if timeout fires
    fileBuffer = await downloadFromS3(s3Key, signal);
  } catch (err) {
    // Re-throw as a named error so outer catch can log it correctly
    throw new Error(
      `Failed to download file: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Check abort between every stage — stops work immediately on timeout
  if (signal.aborted) throw new Error("Processing timed out after 55000ms");

  // ── Stage 2: Parse ──
  // Errors bubble naturally — outer catch in POST owns markFailed()
  const rawText = await parseFile(fileBuffer, document.name);

  if (!rawText.trim()) {
    throw new Error("Document appears to be empty");
  }

  if (signal.aborted) throw new Error("Processing timed out after 55000ms");

  // ── Stage 3: Chunk ──
  const textChunks = chunkText(rawText);

  if (textChunks.length === 0) {
    throw new Error("No chunks produced from document");
  }

  if (signal.aborted) throw new Error("Processing timed out after 55000ms");

  // ── Stage 4: Embed — batched, signal checked between batches ──
  let embeddings: number[][];
  try {
    embeddings = await batchedAsync(textChunks, 10, async (chunk) => {
      // Check abort before each batch item — stops embedding mid-way on timeout
      if (signal.aborted) throw new Error("Processing timed out after 55000ms");
      return embedText(chunk.content);
    });
  } catch (err) {
    throw new Error(
      `Failed to generate embeddings: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (signal.aborted) throw new Error("Processing timed out after 55000ms");

  // ── Stage 5: Bulk insert chunks ──
  const chunkRows = textChunks.map((chunk, i) => ({
    orgId,
    documentId: document.id,
    content: chunk.content,
    embedding: JSON.stringify(embeddings[i]),
  }));

  try {
    await db.insert(chunks).values(chunkRows);
  } catch (err) {
    throw new Error(
      `Failed to store chunks: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return { textChunks };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Guard — requireOrg() also protects against IDOR via orgId scoping below
  const { orgId } = await requireOrg();

  const processLimit = await checkUploadRateLimit(orgId);
  if (!processLimit.success) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Terlalu banyak request pemrosesan.", status: 429 },
      { status: 429 },
    );
  }

  const body = (await request.json()) as ProcessRequestBody;
  const { documentId, s3Key } = body;

  // Validate inputs
  if (typeof documentId !== "number" || typeof s3Key !== "string" || !s3Key) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "documentId and s3Key are required", status: 400 },
      { status: 400 },
    );
  }

  // validated s3Key for length or path traversal
  if (s3Key.length > 500 || s3Key.includes("..")) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid s3Key", status: 400 },
      { status: 400 },
    );
  }

  // IDOR protection — verify the document belongs to this org
  // Returns same error whether the doc is missing or belongs to another org
  const [document] = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, documentId),
        eq(documents.orgId, orgId), // ← tenant isolation
      ),
    )
    .limit(1);

  if (!document) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Document not found", status: 404 },
      { status: 404 },
    );
  }

  // Helper — marks document as failed and notifies dashboard via Pusher
  async function markFailed(): Promise<void> {
    await db
      .update(documents)
      .set({ status: "failed" })
      .where(
        and(eq(documents.id, documentId as number), eq(documents.orgId, orgId)),
      );

    await triggerDocumentUpdated(orgId, {
      documentId: documentId as number,
      status: "failed",
      chunkCount: 0,
    });
  }

  // ── Stages 1–5: Download → Parse → Chunk → Embed → Insert ──
  // Wrapped in a 55s timeout — Vercel cuts functions at 60s

  // AbortController — signals the pipeline to stop between stages on timeout
  const controller = new AbortController();

  let pipelineResult: Awaited<ReturnType<typeof runProcessingPipeline>>;
  try {
    pipelineResult = await Promise.race([
      runProcessingPipeline(orgId, document, s3Key, controller.signal),
      createTimeoutPromise(55_000, controller),
    ]);
  } catch (err) {
    const isTimeout = err instanceof Error && err.message.includes("timed out");

    if (isTimeout) {
      console.error(
        `[documents/process] Timeout processing document ${documentId}`,
      );
      await markFailed();
      return NextResponse.json<ApiResponse>(
        {
          ok: false,
          error:
            "Pemrosesan dokumen memakan waktu terlalu lama. Coba upload ulang dengan file yang lebih kecil.",
          status: 408,
        },
        { status: 408 },
      );
    }

    await markFailed();
    return NextResponse.json<ApiResponse>(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat memproses dokumen.",
        status: 500,
      },
      { status: 500 },
    );
  }

  const { textChunks } = pipelineResult;

  // ── Stage 6: Update document status ──

  await db
    .update(documents)
    .set({
      status: "ready",
      chunkCount: textChunks.length,
    })
    .where(and(eq(documents.id, document.id), eq(documents.orgId, orgId)));

  // ── Stage 7: Notify dashboard via Pusher ──

  // Dashboard is subscribed to org-{orgId} channel — this updates the UI live
  await triggerDocumentUpdated(orgId, {
    documentId: document.id,
    status: "ready",
    chunkCount: textChunks.length,
  });

  return NextResponse.json<ApiResponse<{ chunkCount: number }>>({
    ok: true,
    data: { chunkCount: textChunks.length },
  });
}

// ── File parser ──

// Parses a file buffer into plain text based on the document name extension
async function parseFile(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    // Parse the normal PDF text layer first to preserve the current behavior.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
      buffer: Buffer,
    ) => Promise<{ text: string }>;

    const result = await pdfParse(buffer);
    const text = result.text.trim();

    // Fall back to OCR only when the PDF has no readable text layer.
    if (text) {
      return text;
    }

    return extractTextFromPdfWithOcr(buffer, filename);
  }

  if (ext === "txt") {
    return buffer.toString("utf-8");
  }

  if (ext === "md") {
    return buffer.toString("utf-8");
  }

  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();

    if (!text) {
      throw new Error("DOCX tidak mengandung teks yang bisa diekstrak.");
    }

    return text;
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

// Render scanned PDF pages and run OCR only after normal PDF parsing fails.
async function extractTextFromPdfWithOcr(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  const pageImages = await renderPdfPagesToImages(buffer);

  // Mock mode keeps the upload pipeline testable without a real OCR provider.
  if (env.aiMode === "mock") {
    return pageImages
      .map(
        (_, index) =>
          `[mock ocr] Extracted text from ${filename} page ${index + 1}`,
      )
      .join("\n\n");
  }

  // Real OCR requires a vision-capable OpenAI request.
  if (!env.openaiApiKey) {
    throw new Error(
      "PDF ini membutuhkan OCR, tetapi OPENAI_API_KEY belum dikonfigurasi.",
    );
  }

  const pageTexts = await Promise.all(
    pageImages.map((image, index) => ocrPdfPageWithOpenAI(image, index + 1)),
  );
  const text = pageTexts.join("\n\n").trim();

  // Reject PDFs that still produce no usable text after OCR.
  if (!text) {
    throw new Error(
      "PDF tidak mengandung teks yang bisa diekstrak, bahkan setelah OCR.",
    );
  }

  return text;
}

// Render each PDF page to a JPEG buffer for OCR.
async function renderPdfPagesToImages(buffer: Buffer): Promise<Buffer[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");
  // Preload the worker module so pdf.js can use its in-process fake worker path.
  // @ts-expect-error pdfjs-dist does not ship types for this worker entrypoint.
  const workerModule = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  (
    globalThis as typeof globalThis & {
      pdfjsWorker?: { WorkerMessageHandler?: unknown };
    }
  ).pdfjsWorker = workerModule as { WorkerMessageHandler?: unknown };
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    disableFontFace: true,
  });
  const pdfDocument = await loadingTask.promise;

  // Limiting the number of PDF pages processed for OCR
  // Limit to prevent resource exhaustion
  const MAX_OCR_PAGES = 50;
  if (pdfDocument.numPages > MAX_OCR_PAGES) {
    await pdfDocument.destroy();
    throw new Error(
      `PDF has ${pdfDocument.numPages} pages, exceeding the OCR limit of ${MAX_OCR_PAGES} pages.`,
    );
  }

  const pageImages: Buffer[] = [];

  try {
    for (
      let pageNumber = 1;
      pageNumber <= pdfDocument.numPages;
      pageNumber += 1
    ) {
      // Render one page at a time to limit memory use during OCR fallback.
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      const context = canvas.getContext("2d");

      await page.render({
        // Bridge pdf.js DOM typings to the Node canvas implementation we use on the server.
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;

      pageImages.push(canvas.toBuffer("image/jpeg"));
    }
  } finally {
    await pdfDocument.destroy();
  }

  return pageImages;
}

// Send one rendered PDF page to OpenAI and return only the extracted text.
async function ocrPdfPageWithOpenAI(
  imageBuffer: Buffer,
  pageNumber: number,
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(60_000), // 60 second timeout
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Extract text from document images. Return plain text only with no commentary.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract all readable text from PDF page ${pageNumber}.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBuffer.toString("base64")}`,
                detail: "high",
              },
            },
          ],
        },
      ],
    }),
  });

  // Surface the OCR provider failure instead of silently marking the PDF empty.
  if (!response.ok) {
    throw new Error(`OpenAI OCR error: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  return data.choices?.[0]?.message?.content?.trim() ?? "";
}
