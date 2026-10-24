import { describe, expect, it } from "vitest";
import {
  accommodationName,
  amountInWords,
  nextQuotationNumber,
  quotationTotal,
} from "../src/domain/quotation";

describe("quotation totals", () => {
  it("calculates the source example and spells the monthly total in Indian numbering", () => {
    const total = quotationTotal([
      { id: "a", accommodation: "4 Sharing", persons: 8, rate: 6500 },
      { id: "b", accommodation: "2 Sharing", persons: 2, rate: 9500 },
    ]);
    expect(total).toBe(71000);
    expect(amountInWords(total)).toBe("Rupees Seventy-One Thousand Only");
  });

  it("handles zero, lakh and crore values", () => {
    expect(amountInWords(0)).toBe("Rupees Zero Only");
    expect(amountInWords(1_23_45_678)).toBe(
      "Rupees One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight Only",
    );
  });

  it("prints number-only sharing entries as a full accommodation name", () => {
    expect(accommodationName("4")).toBe("4 Sharing");
    expect(accommodationName("2 sharing")).toBe("2 Sharing");
    expect(accommodationName("Deluxe Single Room")).toBe("Deluxe Single Room");
  });

  it("numbers quotations in order and restarts each financial year", () => {
    const saved = [
      { number: "LLPG/QTN/2026-27/001" },
      { number: "LLPG/QTN/2026-27/009" },
      { number: "LLPG/QTN/2025-26/032" },
    ];
    expect(nextQuotationNumber(saved, "2026-10-21")).toBe(
      "LLPG/QTN/2026-27/010",
    );
    expect(nextQuotationNumber(saved, "2027-04-01")).toBe(
      "LLPG/QTN/2027-28/001",
    );
  });
});
