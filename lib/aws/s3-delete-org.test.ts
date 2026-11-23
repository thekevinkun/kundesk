// Tests for deleteOrgFiles in lib/aws/s3.ts — no real storage or filesystem access
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
const listCommand = vi.hoisted(() => vi.fn());
const deleteCommand = vi.hoisted(() => vi.fn());
const rm = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({ env: mockEnv }));
// Classes used with `new` are defined with `function` (rule 20)
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: function () {
    return { send };
  },
  ListObjectsV2Command: function (input: unknown) {
    listCommand(input);
  },
  DeleteObjectsCommand: function (input: unknown) {
    deleteCommand(input);
  },
}));
// Node built-ins need a `default` export in a vitest mock
vi.mock("fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs/promises")>();
  const mocked = {
    ...actual,
    rm,
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    readFile: vi.fn(),
  };
  return { ...mocked, default: mocked };
});

import { deleteOrgFiles } from "./s3";

describe("deleteOrgFiles", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockEnv.storageMode = "s3";
    mockEnv.awsS3Bucket = "kundesk-bucket";
    mockEnv.awsAccessKeyId = "key-id";
    mockEnv.awsSecretAccessKey = "secret";
    mockEnv.s3Endpoint = "https://example.r2.cloudflarestorage.com";
  });

  describe("org id safety", () => {
    it.each([
      "",
      "org_",
      "org",
      "orgs/",
      "org_a/../org_b",
      "../x",
      "org_a b",
      "org_a/",
    ])("refuses the id %j before touching storage", async (badId) => {
      await expect(deleteOrgFiles(badId)).rejects.toThrow(
        "Invalid org id for file deletion",
      );
      expect(send).not.toHaveBeenCalled();
      expect(rm).not.toHaveBeenCalled();
    });

    it("refuses a bad id in mock mode too", async () => {
      mockEnv.storageMode = "mock";

      await expect(deleteOrgFiles("")).rejects.toThrow("Invalid org id");
      expect(rm).not.toHaveBeenCalled();
    });
  });

  describe("real mode", () => {
    it("lists only that org's prefix", async () => {
      send.mockResolvedValueOnce({ Contents: [], IsTruncated: false });

      await deleteOrgFiles("org_a");

      expect(listCommand).toHaveBeenCalledWith({
        Bucket: "kundesk-bucket",
        Prefix: "orgs/org_a/",
      });
    });

    it("succeeds without a delete call when the org has no files", async () => {
      send.mockResolvedValueOnce({ Contents: [], IsTruncated: false });

      await expect(deleteOrgFiles("org_a")).resolves.toBeUndefined();
      expect(deleteCommand).not.toHaveBeenCalled();
      expect(send).toHaveBeenCalledTimes(1);
    });

    it("treats a response with no Contents field as no files", async () => {
      send.mockResolvedValueOnce({});

      await expect(deleteOrgFiles("org_a")).resolves.toBeUndefined();
      expect(deleteCommand).not.toHaveBeenCalled();
    });

    it("deletes the listed keys in one batch", async () => {
      send
        .mockResolvedValueOnce({
          Contents: [
            { Key: "orgs/org_a/documents/1-a.pdf" },
            { Key: "orgs/org_a/documents/2-b.txt" },
          ],
          IsTruncated: false,
        })
        .mockResolvedValueOnce({});

      await deleteOrgFiles("org_a");

      expect(deleteCommand).toHaveBeenCalledWith({
        Bucket: "kundesk-bucket",
        Delete: {
          Objects: [
            { Key: "orgs/org_a/documents/1-a.pdf" },
            { Key: "orgs/org_a/documents/2-b.txt" },
          ],
          Quiet: true,
        },
      });
    });

    it("skips list entries that have no key", async () => {
      send
        .mockResolvedValueOnce({
          Contents: [{}, { Key: "orgs/org_a/documents/1-a.pdf" }],
          IsTruncated: false,
        })
        .mockResolvedValueOnce({});

      await deleteOrgFiles("org_a");

      expect(deleteCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Delete: {
            Objects: [{ Key: "orgs/org_a/documents/1-a.pdf" }],
            Quiet: true,
          },
        }),
      );
    });

    it("follows the continuation token until the listing is complete", async () => {
      send
        .mockResolvedValueOnce({
          Contents: [{ Key: "orgs/org_a/documents/1-a.pdf" }],
          IsTruncated: true,
          NextContinuationToken: "token-1",
        })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          Contents: [{ Key: "orgs/org_a/documents/2-b.pdf" }],
          IsTruncated: false,
        })
        .mockResolvedValueOnce({});

      await deleteOrgFiles("org_a");

      expect(listCommand).toHaveBeenCalledTimes(2);
      expect(listCommand).toHaveBeenNthCalledWith(2, {
        Bucket: "kundesk-bucket",
        Prefix: "orgs/org_a/",
        ContinuationToken: "token-1",
      });
      expect(deleteCommand).toHaveBeenCalledTimes(2);
    });

    it("throws when storage reports files it could not delete", async () => {
      send
        .mockResolvedValueOnce({
          Contents: [{ Key: "orgs/org_a/documents/1-a.pdf" }],
          IsTruncated: false,
        })
        .mockResolvedValueOnce({
          Errors: [
            { Key: "orgs/org_a/documents/1-a.pdf", Code: "AccessDenied" },
          ],
        });

      await expect(deleteOrgFiles("org_a")).rejects.toThrow(
        "Failed to delete 1 file(s) under orgs/org_a/",
      );
    });

    it("lets a listing error propagate and deletes nothing", async () => {
      send.mockRejectedValueOnce(new Error("boom"));

      await expect(deleteOrgFiles("org_a")).rejects.toThrow("boom");
      expect(deleteCommand).not.toHaveBeenCalled();
    });

    it("throws when storage settings are missing", async () => {
      mockEnv.s3Endpoint = undefined;

      await expect(deleteOrgFiles("org_a")).rejects.toThrow(
        "AWS credentials required",
      );
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe("mock mode (local files)", () => {
    beforeEach(() => {
      mockEnv.storageMode = "mock";
      rm.mockResolvedValue(undefined);
    });

    it("removes only that org's local folder and never touches storage", async () => {
      await deleteOrgFiles("org_a");

      expect(rm).toHaveBeenCalledWith(
        path.resolve("/tmp/mock-uploads", "orgs/org_a"),
        { recursive: true, force: true },
      );
      expect(send).not.toHaveBeenCalled();
    });
  });
});
