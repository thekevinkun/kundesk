// Tests for generatePresignedDownloadUrl in lib/aws/s3.ts — no real storage access
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEnv = vi.hoisted(() => ({
  storageMode: "s3" as string,
  awsS3Bucket: "kundesk-bucket" as string | undefined,
  awsAccessKeyId: "key-id" as string | undefined,
  awsSecretAccessKey: "secret" as string | undefined,
  awsRegion: "auto",
  s3Endpoint: "https://example.r2.cloudflarestorage.com" as string | undefined,
}));
const getCommand = vi.hoisted(() => vi.fn());
const getSignedUrl = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({ env: mockEnv }));
// Classes used with `new` are defined with `function` (rule 20)
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: function () {
    return {};
  },
  GetObjectCommand: function (input: unknown) {
    getCommand(input);
  },
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl }));

import { generatePresignedDownloadUrl } from "./s3";

describe("generatePresignedDownloadUrl", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockEnv.storageMode = "s3";
    mockEnv.awsS3Bucket = "kundesk-bucket";
    mockEnv.awsAccessKeyId = "key-id";
    mockEnv.awsSecretAccessKey = "secret";
    mockEnv.s3Endpoint = "https://example.r2.cloudflarestorage.com";
    getSignedUrl.mockResolvedValue("https://signed.example/file");
  });

  it("returns the signed link", async () => {
    const url = await generatePresignedDownloadUrl(
      "orgs/a/1-x.pdf",
      "x.pdf",
      "inline",
    );
    expect(url).toBe("https://signed.example/file");
  });

  it("asks for the right bucket, key and inline disposition", async () => {
    await generatePresignedDownloadUrl("orgs/a/1-x.pdf", "x.pdf", "inline");
    expect(getCommand).toHaveBeenCalledWith({
      Bucket: "kundesk-bucket",
      Key: "orgs/a/1-x.pdf",
      ResponseContentDisposition: 'inline; filename="x.pdf"',
    });
  });

  it("uses attachment disposition for downloads", async () => {
    await generatePresignedDownloadUrl("k", "x.docx", "attachment");
    expect(getCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        ResponseContentDisposition: 'attachment; filename="x.docx"',
      }),
    );
  });

  it("strips quotes and non-ASCII characters from the filename header", async () => {
    await generatePresignedDownloadUrl("k", 'menu "baru" é.pdf', "inline");
    expect(getCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        ResponseContentDisposition: 'inline; filename="menu__baru___.pdf"',
      }),
    );
  });

  it("makes the link live for 60 seconds", async () => {
    await generatePresignedDownloadUrl("k", "x.pdf", "inline");
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 60 },
    );
  });

  it("returns null in mock mode without touching storage", async () => {
    mockEnv.storageMode = "mock";
    expect(
      await generatePresignedDownloadUrl("k", "x.pdf", "inline"),
    ).toBeNull();
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it("throws when storage settings are missing", async () => {
    mockEnv.s3Endpoint = undefined;
    await expect(
      generatePresignedDownloadUrl("k", "x.pdf", "inline"),
    ).rejects.toThrow("AWS credentials required");
  });
});
