// Unit tests for the Midtrans startup key check

import { describe, it, expect } from "vitest";
import { validateMidtransConfig } from "./midtrans-config";
import type { MidtransConfigInput } from "@/types/midtrans-config";

// A valid real-mode setup shaped like the project's own sandbox keys (no SB- prefix)
function config(
  overrides: Partial<MidtransConfigInput> = {},
): MidtransConfigInput {
  return {
    paymentMode: "midtrans",
    serverKey: "Mid-server-abc123",
    clientKey: "Mid-client-abc123",
    isProduction: false,
    ...overrides,
  };
}

describe("validateMidtransConfig", () => {
  it("does nothing in mock mode, even with missing keys", () => {
    expect(() =>
      validateMidtransConfig(
        config({
          paymentMode: "mock",
          serverKey: undefined,
          clientKey: undefined,
        }),
      ),
    ).not.toThrow();
  });

  it("accepts the current sandbox key style (no SB- prefix)", () => {
    expect(() => validateMidtransConfig(config())).not.toThrow();
  });

  it("accepts SB- keys in sandbox mode", () => {
    expect(() =>
      validateMidtransConfig(
        config({
          serverKey: "SB-Mid-server-abc123",
          clientKey: "SB-Mid-client-abc123",
        }),
      ),
    ).not.toThrow();
  });

  it("accepts non-SB keys in production mode", () => {
    expect(() =>
      validateMidtransConfig(config({ isProduction: true })),
    ).not.toThrow();
  });

  it("throws when the server key is missing", () => {
    expect(() =>
      validateMidtransConfig(config({ serverKey: undefined })),
    ).toThrow("Missing MIDTRANS_SERVER_KEY");
  });

  it("throws when the client key is missing", () => {
    expect(() =>
      validateMidtransConfig(config({ clientKey: undefined })),
    ).toThrow("Missing MIDTRANS_CLIENT_KEY");
  });

  it("throws on an empty key", () => {
    expect(() => validateMidtransConfig(config({ serverKey: "" }))).toThrow(
      "Missing MIDTRANS_SERVER_KEY",
    );
  });

  it("throws on whitespace around a key", () => {
    expect(() =>
      validateMidtransConfig(config({ serverKey: "Mid-server-abc123\n" })),
    ).toThrow("whitespace");
    expect(() =>
      validateMidtransConfig(config({ clientKey: " Mid-client-abc123" })),
    ).toThrow("whitespace");
  });

  it("throws when the keys look swapped", () => {
    expect(() =>
      validateMidtransConfig(
        config({
          serverKey: "Mid-client-abc123",
          clientKey: "Mid-server-abc123",
        }),
      ),
    ).toThrow("swapped");
  });

  it("throws when one key is sandbox and the other is not", () => {
    expect(() =>
      validateMidtransConfig(config({ serverKey: "SB-Mid-server-abc123" })),
    ).toThrow("different environments");
    expect(() =>
      validateMidtransConfig(config({ clientKey: "SB-Mid-client-abc123" })),
    ).toThrow("different environments");
  });

  it("throws when production is on but the keys are sandbox keys", () => {
    expect(() =>
      validateMidtransConfig(
        config({
          isProduction: true,
          serverKey: "SB-Mid-server-abc123",
          clientKey: "SB-Mid-client-abc123",
        }),
      ),
    ).toThrow("sandbox keys");
  });

  it("never puts a key value in an error message", () => {
    let message = "";
    try {
      validateMidtransConfig(config({ serverKey: "Mid-server-SECRET999\n" }));
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).not.toContain("SECRET999");
  });
});
