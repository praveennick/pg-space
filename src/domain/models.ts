import { z } from "zod/v4";
const id = z.string().min(1);
const money = z.number().int().nonnegative().max(1_000_000_000);
const date = z.iso.date();
const base = { id, createdAt: z.string() };
export const schemas = {
  rooms: z.object({
    ...base,
    number: z.string().trim().min(1).max(20),
    floor: z.number().int().min(0).max(50),
    capacity: z.number().int().min(1).max(26),
    rent: money,
    deposit: money,
    facilities: z.array(z.string()),
    description: z.string(),
    archived: z.boolean(),
  }),
  beds: z.object({
    ...base,
    roomId: id,
    label: z.string(),
    position: z.number().int().nonnegative(),
    rent: money.nullable(),
    retired: z.boolean(),
  }),
  tenants: z.object({
    ...base,
    name: z.string().trim().min(2),
    phone: z.string().min(5),
    email: z.union([z.email(), z.literal("")]),
    address: z.string(),
    emergency: z.string(),
    occupation: z.string(),
    idMetadata: z.string(),
    photo: z
      .object({
        key: z.string(),
        mimeType: z.string(),
        size: z.number().int().nonnegative(),
        updatedAt: z.string(),
      })
      .optional(),
    verification: z
      .object({
        status: z.enum(["Not checked", "Pending", "Verified", "Rejected"]),
        date: z.union([date, z.literal("")]),
        method: z.enum([
          "",
          "Driving licence",
          "Voter ID",
          "Passport",
          "Aadhaar checked in person",
          "Other ID",
        ]),
        staff: z.string(),
        consent: z.boolean().optional(),
      })
      .refine(
        (value) =>
          value.status !== "Verified" ||
          !!(value.date && value.method && value.staff.trim()),
        {
          message: "Verified ID checks need a date, method and staff name.",
        },
      )
      .refine(
        (value) =>
          value.method !== "Aadhaar checked in person" ||
          value.status !== "Verified" ||
          value.consent === true,
        {
          message:
            "Record voluntary consent before marking an Aadhaar check verified.",
        },
      )
      .optional(),
    notes: z.string(),
  }),
  occupancies: z.object({
    ...base,
    tenantId: id,
    bedId: id,
    start: date,
    end: date.nullable(),
    rent: money,
    deposit: money,
    dueDay: z.number().int().min(1).max(28),
    expectedCheckout: z.union([date, z.literal("")]),
  }),
  reservations: z.object({
    ...base,
    name: z.string().min(2),
    phone: z.string().min(5),
    bedId: id,
    checkIn: date,
    expires: date,
    amount: money,
    status: z.enum([
      "Pending",
      "Confirmed",
      "Checked In",
      "Cancelled",
      "Expired",
    ]),
    notes: z.string(),
  }),
  invoices: z.object({
    ...base,
    tenantId: id,
    occupancyId: id,
    month: z.string().regex(/^\d{4}-\d{2}$/),
    due: date,
    amount: money,
    description: z.string(),
  }),
  payments: z.object({
    ...base,
    tenantId: id,
    amount: money.positive(),
    date,
    method: z.enum(["Cash", "UPI", "Bank Transfer", "Card", "Other"]),
    reference: z.string(),
    notes: z.string(),
    key: id,
  }),
  allocations: z.object({
    ...base,
    paymentId: id,
    invoiceId: id,
    amount: money.positive(),
  }),
  deposits: z.object({
    ...base,
    tenantId: id,
    occupancyId: id,
    type: z.enum(["Collected", "Deduction", "Refund"]),
    amount: money.positive(),
    date,
    notes: z.string(),
  }),
  expenses: z.object({
    ...base,
    title: z.string().min(2),
    amount: money.positive(),
    category: z.string().min(1),
    date,
    method: z.string(),
    vendor: z.string(),
    notes: z.string(),
    recurring: z.boolean(),
    receipt: z.string(),
  }),
  tickets: z.object({
    ...base,
    roomId: id,
    bedId: z.string(),
    category: z.string(),
    description: z.string().min(3),
    priority: z.enum(["Low", "Medium", "High", "Urgent"]),
    status: z.enum(["Open", "In Progress", "Resolved", "Closed"]),
    block: z.boolean(),
    resolution: z.string(),
  }),
  notifications: z.object({
    ...base,
    title: z.string(),
    message: z.string(),
    href: z.string().regex(/^\/app\/[a-z]+(?:[/?][a-zA-Z0-9?=&_-]*)?$/),
    read: z.boolean(),
  }),
  audit: z.object({ ...base, action: z.string(), detail: z.string() }),
  quotations: z.object({
    ...base,
    updatedAt: z.string(),
    number: z.string().min(1),
    date,
    recipient: z.string(),
    address: z.string(),
    subject: z.string(),
    introduction: z.string(),
    items: z
      .array(
        z.object({
          id,
          accommodation: z.string(),
          persons: z.number().int().positive(),
          rate: money,
        }),
      )
      .min(1),
    notes: z.string(),
    closing: z.string(),
    signatory: z.string(),
  }),
  settings: z.object({
    id: z.literal("property"),
    name: z.string().min(2),
    address: z.string(),
    phone: z.string(),
    email: z.string(),
    floors: z.number().int().min(1).max(50),
    maxCapacity: z.number().int().min(1).max(26),
    defaultRent: money,
    defaultDeposit: money,
    dueDay: z.number().int().min(1).max(28),
    graceDays: z.number().int().min(0).max(30),
    prorate: z.boolean(),
    receiptPrefix: z.string().min(1),
    notifications: z.boolean(),
    reducedMotion: z.boolean(),
  }),
};
export type Entities = {
  [K in keyof typeof schemas]: z.infer<(typeof schemas)[K]>;
};
export type EntityName = keyof Entities;
export type Snapshot = { [K in EntityName]: Entities[K][] };
export type Room = Entities["rooms"];
export type Bed = Entities["beds"];
export type Tenant = Entities["tenants"];
export type Occupancy = Entities["occupancies"];
export type Settings = Entities["settings"];
export const names = Object.keys(schemas) as EntityName[];
export const emptySnapshot = (): Snapshot =>
  Object.fromEntries(names.map((n) => [n, []])) as unknown as Snapshot;
export const uid = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  // randomUUID is restricted to secure contexts, while getRandomValues also
  // works when opening the local demo from a phone over LAN HTTP.
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error("This browser does not provide a random number generator.");
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
export const stamp = () => ({ id: uid(), createdAt: new Date().toISOString() });
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const monthNow = () => today().slice(0, 7);
export const rupees = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: paise % 100 ? 2 : 0,
  }).format(paise / 100);
export const paise = (value: string | number) => {
  const s = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(s))
    throw new Error("Enter a positive amount with at most two decimal places.");
  return Math.round(Number(s) * 100);
};
