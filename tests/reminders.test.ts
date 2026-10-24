import { describe, expect, it } from "vitest";
import {
  buildReminderMessage,
  buildWhatsAppLink,
  normalizeWhatsAppNumber,
  validateWhatsAppNumber,
} from "../src/services/reminders";

describe("whatsapp reminder utilities", () => {
  it("normalizes and validates Indian mobile numbers", () => {
    expect(normalizeWhatsAppNumber("+91 98765 43210")).toBe("919876543210");
    expect(normalizeWhatsAppNumber("09876543210")).toBe("919876543210");
    expect(validateWhatsAppNumber("9876543210")).toBe(true);
    expect(validateWhatsAppNumber("1234567890")).toBe(false);
    expect(validateWhatsAppNumber("12345")).toBe(false);
  });

  it("builds a personalized rent due reminder for WhatsApp", () => {
    const message = buildReminderMessage("rent-due", {
      tenantName: "Anil",
      roomNumber: "A-102",
      monthlyRent: 12000,
      outstandingBalance: 12000,
      dueDate: "2026-10-30",
      propertyName: "Lucky Luxury PG",
    });

    expect(message).toContain("Anil");
    expect(message).toContain("A-102");
    expect(message).toContain("₹12,000.00");
    expect(message).toContain("30-10-2026");
  });

  it("creates a valid wa.me link with encoded text", () => {
    const link = buildWhatsAppLink({
      phone: "+91 98765 43210",
      template: "rent-overdue",
      fields: {
        tenantName: "Priya",
        roomNumber: "B-4",
        monthlyRent: 15000,
        outstandingBalance: 27000,
        dueDate: "2026-10-10",
        propertyName: "Lucky Luxury PG",
      },
    });

    expect(link).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/);
    const text = decodeURIComponent(link.split("?text=")[1]);
    expect(text).toContain("Priya");
    expect(text).toContain("₹27,000.00");
  });
});
