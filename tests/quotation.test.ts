import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  accommodationName,
  amountInWords,
  nextQuotationNumber,
  quotationTotal,
} from "../src/domain/quotation";
import { LocalStore } from "../src/data/local";
import { ApplicationService } from "../src/services/application";

const addImageMock = vi.fn();
const saveMock = vi.fn();
const textMock = vi.fn();
const setFontMock = vi.fn();
const setFontSizeMock = vi.fn();
const setTextColorMock = vi.fn();

vi.mock("jspdf", () => {
  class MockPdf {
    setFont = setFontMock;
    setFontSize = setFontSizeMock;
    setTextColor = setTextColorMock;
    text = textMock;
    addImage = addImageMock;
    save = saveMock;
    splitTextToSize = vi.fn((value: string) => [value]);
    getTextWidth = vi.fn(() => 80);
    setDrawColor = vi.fn();
    setFillColor = vi.fn();
    setLineWidth = vi.fn();
    rect = vi.fn();
    line = vi.fn();
    addPage = vi.fn();
    constructor() {}
  }

  return { jsPDF: MockPdf };
});

describe("quotation totals", () => {
  beforeEach(() => {
    addImageMock.mockClear();
    saveMock.mockClear();
    textMock.mockClear();
    setFontMock.mockClear();
    setFontSizeMock.mockClear();
    setTextColorMock.mockClear();

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = "";
      set src(value: string) {
        this._src = value;
        queueMicrotask(() => this.onload?.());
      }
      get src() {
        return this._src;
      }
    }

    Object.defineProperty(globalThis, "Image", {
      value: MockImage,
      configurable: true,
    });
    Object.defineProperty(window, "Image", {
      value: MockImage,
      configurable: true,
    });
  });

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

  it("clears blocked repairs when a ticket is closed", async () => {
    const store = new LocalStore("pg-space-ticket-closed-test");
    const service = new ApplicationService(store);
    await store.transact((s) => {
      s.rooms.push({
        id: "room-1",
        createdAt: "2026-10-18T00:00:00.000Z",
        number: "101",
        floor: 1,
        capacity: 2,
        rent: 12000,
        deposit: 5000,
        facilities: [],
        description: "",
        archived: false,
      });
      s.beds.push({
        id: "bed-1",
        createdAt: "2026-10-18T00:00:00.000Z",
        roomId: "room-1",
        label: "101-A",
        position: 1,
        rent: 12000,
        retired: false,
      });
    });

    const ticket = {
      id: "ticket-1",
      createdAt: "2026-10-18T00:00:00.000Z",
      roomId: "room-1",
      bedId: "bed-1",
      category: "Cleaning",
      description: "Prepare bed after tenant departure",
      priority: "Medium" as const,
      status: "Open" as const,
      block: true,
      resolution: "",
    };
    await service.ticket(ticket);
    await service.ticketStatus(ticket.id, "Closed", "Cleaned");
    const state = await store.read();
    expect(state.tickets[0].block).toBe(false);
    expect(state.tickets[0].status).toBe("Closed");
  });

  it("adds the branded letterhead to payment receipts", async () => {
    const { receipt } = await import("../src/services/export");
    const payment = {
      id: "pay_123",
      tenantId: "tenant_1",
      amount: 25000,
      date: "2026-10-20",
      method: "UPI",
      reference: "TXN-001",
      notes: "",
      key: "pay_key",
      createdAt: "2026-10-18T00:00:00.000Z",
    };
    const snapshot = {
      rooms: [],
      beds: [
        {
          id: "bed_1",
          roomId: "room_1",
          label: "A-101",
          position: 1,
          rent: 12000,
          retired: false,
          createdAt: "2026-10-18T00:00:00.000Z",
        },
      ],
      tenants: [
        {
          id: "tenant_1",
          name: "Aarav Singh",
          phone: "9876543210",
          email: "",
          address: "",
          emergency: "",
          occupation: "",
          idMetadata: "",
          notes: "",
          createdAt: "2026-10-18T00:00:00.000Z",
        },
      ],
      occupancies: [
        {
          id: "occ_1",
          tenantId: "tenant_1",
          bedId: "bed_1",
          start: "2026-09-01",
          end: null,
          rent: 12000,
          deposit: 5000,
          dueDay: 5,
          expectedCheckout: "",
          createdAt: "2026-10-18T00:00:00.000Z",
        },
      ],
      invoices: [
        {
          id: "inv_1",
          tenantId: "tenant_1",
          occupancyId: "occ_1",
          month: "2026-10",
          due: "2026-10-05",
          amount: 12000,
          description: "Rent",
          createdAt: "2026-10-18T00:00:00.000Z",
        },
      ],
      payments: [payment],
      allocations: [
        {
          id: "alloc_1",
          paymentId: "pay_123",
          invoiceId: "inv_1",
          amount: 12000,
          createdAt: "2026-10-18T00:00:00.000Z",
        },
      ],
      deposits: [],
      expenses: [],
      tickets: [],
      notifications: [],
      audit: [],
      quotations: [],
      settings: [
        {
          id: "property",
          name: "Lucky Luxury Mens PG",
          address: "",
          phone: "",
          email: "",
          floors: 1,
          maxCapacity: 1,
          defaultRent: 12000,
          defaultDeposit: 5000,
          dueDay: 5,
          graceDays: 2,
          prorate: true,
          receiptPrefix: "LLPG",
          notifications: true,
          reducedMotion: false,
        },
      ],
    } as any;

    await receipt(snapshot as any, payment as any);

    expect(addImageMock).toHaveBeenCalledWith(
      expect.anything(),
      "PNG",
      0,
      0,
      210,
      50,
    );
    expect(addImageMock).toHaveBeenCalledWith(
      expect.anything(),
      "PNG",
      0,
      264.6,
      210,
      32.4,
    );
  });
});
