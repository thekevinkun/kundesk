import { describe, it, expect } from "vitest";
import { isMissingObjectError } from "./storage-errors";

describe("isMissingObjectError", () => {
  it("recognises the storage 'not found' errors", () => {
    expect(isMissingObjectError({ name: "NotFound" })).toBe(true);
    expect(isMissingObjectError({ name: "NoSuchKey" })).toBe(true);
    expect(isMissingObjectError({ $metadata: { httpStatusCode: 404 } })).toBe(
      true,
    );
  });

  it("recognises a missing local file in mock mode", () => {
    expect(isMissingObjectError({ code: "ENOENT" })).toBe(true);
  });

  it("does not treat a missing bucket as a missing file", () => {
    expect(
      isMissingObjectError({
        name: "NoSuchBucket",
        $metadata: { httpStatusCode: 404 },
      }),
    ).toBe(false);
  });

  it("does not treat other failures as missing", () => {
    expect(isMissingObjectError({ $metadata: { httpStatusCode: 403 } })).toBe(
      false,
    );
    expect(isMissingObjectError(new Error("timeout"))).toBe(false);
    expect(isMissingObjectError({ name: "TimeoutError" })).toBe(false);
  });

  it("returns false for values that are not error objects", () => {
    expect(isMissingObjectError(null)).toBe(false);
    expect(isMissingObjectError(undefined)).toBe(false);
    expect(isMissingObjectError("NotFound")).toBe(false);
  });
});
