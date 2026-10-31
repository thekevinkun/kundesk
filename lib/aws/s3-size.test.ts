// Tests for getS3ObjectSize in lib/aws/s3.ts — no real AWS or filesystem access
import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";

// Hoisted so the vi.mock factories below can reference them (rule 163)
const mockEnv = vi.hoisted(() => ({
  storageMode: "s3" as string,
  awsS3Bucket: "kundesk-bucket" as string | undefined,
  awsAccessKeyId: "key-id" as string | undefined,
  awsSecretAccessKey: "secret" as string | undefined,
  awsRegion: "ap-southeast-1",
}));
const send = vi.hoisted(() => vi.fn());
const headCommand = vi.hoisted(() => vi.fn());
const stat = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({ env: mockEnv }));
// Classes used with `new` are defined with `function` (rules 20, 163)
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: function () {
    return { send };
  },
  HeadObjectCommand: function (input: unknown) {
    headCommand(input);
  },
}));
// s3.ts imports writeFile and mkdir at the top, so the mock must provide them too.
// Node built-ins also need a `default` export in a vitest mock, so the real module is spread in
// and the same object is exposed as default.
vi.mock("fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs/promises")>();
  const mocked = {
    ...actual,
    stat,
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    readFile: vi.fn(),
  };
  return { ...mocked, default: mocked };
});

import { getS3ObjectSize } from "./s3";

describe("getS3ObjectSize", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockEnv.storageMode = "s3";
    mockEnv.awsS3Bucket = "kundesk-bucket";
    mockEnv.awsAccessKeyId = "key-id";
    mockEnv.awsSecretAccessKey = "secret";
  });

  describe("real mode (S3)", () => {
    it("returns the ContentLength that HeadObject reports", async () => {
      send.mockResolvedValue({ ContentLength: 4321 });

      expect(await getS3ObjectSize("orgs/org_a/documents/1-menu.pdf")).toBe(
        4321,
      );
    });

    it("asks for the right bucket and key", async () => {
      send.mockResolvedValue({ ContentLength: 1 });

      await getS3ObjectSize("orgs/org_a/documents/1-menu.pdf");

      expect(headCommand).toHaveBeenCalledWith({
        Bucket: "kundesk-bucket",
        Key: "orgs/org_a/documents/1-menu.pdf",
      });
    });

    it("passes the abort signal when one is given, and nothing when it is not", async () => {
      send.mockResolvedValue({ ContentLength: 1 });
      const controller = new AbortController();

      await getS3ObjectSize("k", controller.signal);
      expect(send).toHaveBeenLastCalledWith(expect.anything(), {
        abortSignal: controller.signal,
      });

      await getS3ObjectSize("k");
      expect(send).toHaveBeenLastCalledWith(expect.anything(), undefined);
    });

    it("throws when S3 does not report a size", async () => {
      send.mockResolvedValue({});

      await expect(getS3ObjectSize("k")).rejects.toThrow(
        "No size in S3 response",
      );
    });

    it("lets an S3 error (for example a missing object) propagate", async () => {
      send.mockRejectedValue(new Error("NotFound"));

      await expect(getS3ObjectSize("k")).rejects.toThrow("NotFound");
    });

    it("throws when AWS credentials are missing", async () => {
      mockEnv.awsSecretAccessKey = undefined;

      await expect(getS3ObjectSize("k")).rejects.toThrow(
        "AWS credentials required",
      );
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe("mock mode (local files)", () => {
    beforeEach(() => {
      mockEnv.storageMode = "mock";
    });

    it("returns the size of the local file", async () => {
      stat.mockResolvedValue({ size: 777 });

      expect(await getS3ObjectSize("orgs/org_a/documents/1-menu.txt")).toBe(
        777,
      );
      expect(stat).toHaveBeenCalledWith(
        path.resolve("/tmp/mock-uploads", "orgs/org_a/documents/1-menu.txt"),
      );
      // Mock mode never touches S3
      expect(send).not.toHaveBeenCalled();
    });

    it("refuses a key that escapes the mock upload folder", async () => {
      await expect(getS3ObjectSize("../../etc/passwd")).rejects.toThrow(
        "Invalid mock upload key",
      );
      expect(stat).not.toHaveBeenCalled();
    });
  });
});
