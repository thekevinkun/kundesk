// Unit tests for billing types and dashboard billing constants
// Covers: PLAN_LIMITS correctness, PLAN_PRICE correctness, getStatusDisplay

import { describe, it, expect } from "vitest";
import { PLAN_LIMITS, PLAN_PRICE } from "@/types/billing";
import { getStatusDisplay } from "@/components/dashboard/billing/constants";

describe("PLAN_LIMITS", () => {
  describe("free plan", () => {
    it("allows 100 messages per month", () => {
      expect(PLAN_LIMITS.free.messagesPerMonth).toBe(100);
    });

    it("allows 3 documents", () => {
      expect(PLAN_LIMITS.free.documents).toBe(3);
    });

    it("allows 1 chatbot", () => {
      expect(PLAN_LIMITS.free.chatbots).toBe(1);
    });

    it("does not include embed widget", () => {
      expect(PLAN_LIMITS.free.embedWidget).toBe(false);
    });

    it("does not include whatsapp", () => {
      expect(PLAN_LIMITS.free.whatsapp).toBe(false);
    });

    it("does not include analytics", () => {
      expect(PLAN_LIMITS.free.analytics).toBe(false);
    });

    it("does not include custom branding", () => {
      expect(PLAN_LIMITS.free.customBranding).toBe(false);
    });

    it("does not include API access", () => {
      expect(PLAN_LIMITS.free.apiAccess).toBe(false);
    });
  });

  describe("starter plan", () => {
    it("allows 1000 messages per month", () => {
      expect(PLAN_LIMITS.starter.messagesPerMonth).toBe(1000);
    });

    it("allows 20 documents", () => {
      expect(PLAN_LIMITS.starter.documents).toBe(20);
    });

    it("allows 1 chatbot", () => {
      expect(PLAN_LIMITS.starter.chatbots).toBe(1);
    });

    it("includes embed widget", () => {
      expect(PLAN_LIMITS.starter.embedWidget).toBe(true);
    });

    it("includes analytics", () => {
      expect(PLAN_LIMITS.starter.analytics).toBe(true);
    });

    it("does not include whatsapp", () => {
      expect(PLAN_LIMITS.starter.whatsapp).toBe(false);
    });

    it("does not include custom branding", () => {
      expect(PLAN_LIMITS.starter.customBranding).toBe(false);
    });

    it("does not include API access", () => {
      expect(PLAN_LIMITS.starter.apiAccess).toBe(false);
    });
  });

  describe("pro plan", () => {
    it("allows 10000 messages per month", () => {
      expect(PLAN_LIMITS.pro.messagesPerMonth).toBe(10000);
    });

    it("allows unlimited documents", () => {
      expect(PLAN_LIMITS.pro.documents).toBe(Infinity);
    });

    it("allows 3 chatbots", () => {
      expect(PLAN_LIMITS.pro.chatbots).toBe(3);
    });

    it("includes embed widget", () => {
      expect(PLAN_LIMITS.pro.embedWidget).toBe(true);
    });

    it("includes whatsapp", () => {
      expect(PLAN_LIMITS.pro.whatsapp).toBe(true);
    });

    it("includes analytics", () => {
      expect(PLAN_LIMITS.pro.analytics).toBe(true);
    });

    it("includes custom branding", () => {
      expect(PLAN_LIMITS.pro.customBranding).toBe(true);
    });

    it("includes API access", () => {
      expect(PLAN_LIMITS.pro.apiAccess).toBe(true);
    });
  });

  describe("plan hierarchy — each plan has more than the previous", () => {
    it("starter has more messages than free", () => {
      expect(PLAN_LIMITS.starter.messagesPerMonth).toBeGreaterThan(
        PLAN_LIMITS.free.messagesPerMonth,
      );
    });

    it("pro has more messages than starter", () => {
      expect(PLAN_LIMITS.pro.messagesPerMonth).toBeGreaterThan(
        PLAN_LIMITS.starter.messagesPerMonth,
      );
    });

    it("starter has more documents than free", () => {
      expect(PLAN_LIMITS.starter.documents).toBeGreaterThan(
        PLAN_LIMITS.free.documents,
      );
    });

    it("pro has more documents than starter", () => {
      expect(PLAN_LIMITS.pro.documents).toBeGreaterThan(
        PLAN_LIMITS.starter.documents,
      );
    });
  });
});

describe("PLAN_PRICE", () => {
  it("free plan costs 0", () => {
    expect(PLAN_PRICE.free).toBe(0);
  });

  it("starter plan costs Rp 149.000", () => {
    expect(PLAN_PRICE.starter).toBe(149000);
  });

  it("pro plan costs Rp 399.000", () => {
    expect(PLAN_PRICE.pro).toBe(399000);
  });

  it("each paid plan costs more than the previous", () => {
    expect(PLAN_PRICE.starter).toBeGreaterThan(PLAN_PRICE.free);
    expect(PLAN_PRICE.pro).toBeGreaterThan(PLAN_PRICE.starter);
  });
});

describe("getStatusDisplay", () => {
  it("returns correct label and badge class for active", () => {
    const result = getStatusDisplay("active");
    expect(result.label).toBe("Aktif");
    expect(result.className).toContain("badge-success");
  });

  it("returns correct label and badge class for past_due", () => {
    const result = getStatusDisplay("past_due");
    expect(result.label).toBe("Tagihan Jatuh Tempo");
    expect(result.className).toContain("badge-warning");
  });

  it("returns correct label and badge class for suspended", () => {
    const result = getStatusDisplay("suspended");
    expect(result.label).toBe("Disuspend");
    expect(result.className).toContain("badge-danger");
  });

  it("returns correct label and badge class for cancelled", () => {
    const result = getStatusDisplay("cancelled");
    expect(result.label).toBe("Dibatalkan");
    expect(result.className).toContain("badge-danger");
  });

  it("returns correct label and badge class for free", () => {
    const result = getStatusDisplay("free");
    expect(result.label).toBe("Gratis");
    expect(result.className).toContain("badge-brand");
  });
});
