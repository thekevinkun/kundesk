// Tests for deleteFromStorage in lib/aws/s3.ts — no real storage or filesystem access
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";

const mockEnv = vi.hoisted(() => ({
  storageMode: "s3" as string,
  awsS3Bucket: "kundesk-bucket" as string | undefined,
  awsAccessKeyId: "key-id" as string | undefined,
  awsSecretAccessKey: "secret" as string | undefined,
  awsRegion: "auto",
  s3Endpoint: "https://example.r2.cloudflarestorage.com" as string | undefined,
}));
const send = vi.hoisted(() => vi.fn());
const deleteCommand = vi.hoisted(() => vi.fn());
const unlink = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({ env: mockEnv }));
// Classes used with `new` are defined with `function` (rule 20)
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: function () {
    return { send };
  },
  DeleteObjectCommand: function (input: unknown) {
    deleteCommand(input);
  },
}));
// Node built-ins need a `default` export in a vitest mock
vi.mock("fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs/promises")>();
  const mocked = {
    ...actual,
    unlink,
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    readFile: vi.fn(),
  };
  return { ...mocked, default: mocked };
});

import { deleteFromStorage } from "./s3";

describe("deleteFromStorage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockEnv.storageMode = "s3";
    mockEnv.awsS3Bucket = "kundesk-bucket";
    mockEnv.awsAccessKeyId = "key-id";
    mockEnv.awsSecretAccessKey = "secret";
    mockEnv.s3Endpoint = "https://example.r2.cloudflarestorage.com";
    send.mockResolvedValue({});
  });

  describe("real mode", () => {
    it("deletes the right bucket and key", async () => {
      await deleteFromStorage("orgs/org_a/documents/1-menu.pdf");

      expect(deleteCommand).toHaveBeenCalledWith({
        Bucket: "kundesk-bucket",
        Key: "orgs/org_a/documents/1-menu.pdf",
      });
      expect(send).toHaveBeenCalledTimes(1);
    });

    it("lets a storage error propagate", async () => {
      send.mockRejectedValue(new Error("boom"));

      await expect(deleteFromStorage("k")).rejects.toThrow("boom");
    });

    it("throws when storage settings are missing", async () => {
      mockEnv.s3Endpoint = undefined;

      await expect(deleteFromStorage("k")).rejects.toThrow(
        "AWS credentials required",
      );
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe("mock mode (local files)", () => {
    beforeEach(() => {
      mockEnv.storageMode = "mock";
      unlink.mockResolvedValue(undefined);
    });

    it("removes the local file and never touches storage", async () => {
      await deleteFromStorage("orgs/org_a/documents/1-menu.txt");

      expect(unlink).toHaveBeenCalledWith(
        path.resolve("/tmp/mock-uploads", "orgs/org_a/documents/1-menu.txt"),
      );
      expect(send).not.toHaveBeenCalled();
    });

    it("counts a file that is already gone as success", async () => {
      unlink.mockRejectedValue(
        Object.assign(new Error("gone"), { code: "ENOENT" }),
      );

      await expect(deleteFromStorage("k.txt")).resolves.toBeUndefined();
    });

    it("rethrows any other filesystem error", async () => {
      unlink.mockRejectedValue(
        Object.assign(new Error("denied"), { code: "EACCES" }),
      );

      await expect(deleteFromStorage("k.txt")).rejects.toThrow("denied");
    });

    it("refuses a key that escapes the mock upload folder", async () => {
      await expect(deleteFromStorage("../../etc/passwd")).rejects.toThrow(
        "Invalid mock upload key",
      );
      expect(unlink).not.toHaveBeenCalled();
    });
  });
});
