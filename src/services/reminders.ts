import { balance } from "../domain/calculations";
import { displayDate } from "../domain/dates";
import type { Snapshot } from "../domain/models";

export type ReminderTemplateName =
  "rent-due" | "rent-overdue" | "payment-confirmation" | "welcome-message";

export const REMINDER_TEMPLATE_LABELS: Record<ReminderTemplateName, string> = {
  "rent-due": "Rent Due",
  "rent-overdue": "Rent Overdue",
  "payment-confirmation": "Payment Confirmation",
  "welcome-message": "Welcome Message",
};

export type ReminderContext = {
  tenantName: string;
  phone?: string;
  roomNumber: string;
  monthlyRent: number;
  outstandingBalance: number;
  dueDate: string;
  propertyName: string;
  lastPaymentAmount?: number;
};

const formatCurrency = (amountInRupees: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountInRupees);

const formatDate = (isoDate: string) => {
  if (!isoDate) return "your next due date";
  return displayDate(isoDate);
};

export function normalizeWhatsAppNumber(phone: string) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (/^91\d{10}$/.test(digits)) return digits;
  if (/^0\d{10}$/.test(digits)) return `91${digits.slice(1)}`;
  if (/^\d{10}$/.test(digits)) return `91${digits}`;
  if (/^\d{12}$/.test(digits) && digits.startsWith("91")) return digits;
  return digits;
}

export function validateWhatsAppNumber(phone: string) {
  const normalized = normalizeWhatsAppNumber(phone);
  return /^91[6-9]\d{9}$/.test(normalized);
}

export function buildBillReminderMessage(fields: ReminderContext) {
  const tenantName = fields.tenantName || "Resident";
  const roomNumber = fields.roomNumber || "your room";
  const propertyName = fields.propertyName || "PG Space";
  const monthlyRent = formatCurrency(fields.monthlyRent);
  const outstanding = formatCurrency(fields.outstandingBalance);
  const dueDate = formatDate(fields.dueDate);

  return [
    `Hi ${tenantName},`,
    "",
    `Your rent bill for ${roomNumber} is ready.`,
    `Monthly rent: ${monthlyRent}`,
    `Outstanding balance: ${outstanding}`,
    `Due date: ${dueDate}`,
    "Please review the billed amount and make the payment at your earliest convenience.",
    "If you need any help with the breakdown, feel free to message us.",
    "",
    `Regards,\n${propertyName}`,
  ].join("\n");
}

export function buildReminderMessage(
  template: ReminderTemplateName,
  fields: ReminderContext,
) {
  const tenantName = fields.tenantName || "Resident";
  const roomNumber = fields.roomNumber || "your room";
  const propertyName = fields.propertyName || "PG Space";
  const monthlyRent = formatCurrency(fields.monthlyRent);
  const outstanding = formatCurrency(fields.outstandingBalance);
  const dueDate = formatDate(fields.dueDate);

  const templateMessage: Record<ReminderTemplateName, string[]> = {
    "rent-due": [
      `Hi ${tenantName},`,
      "",
      `This is a friendly reminder that your rent for ${roomNumber} is due on ${dueDate}.`,
      `Monthly rent: ${monthlyRent}`,
      `Outstanding balance: ${outstanding}`,
      "Please make the payment at your earliest convenience.",
      "Thank you for staying with us.",
      "",
      `Regards,\n${propertyName}`,
    ],
    "rent-overdue": [
      `Hi ${tenantName},`,
      "",
      `This is a reminder that the rent for ${roomNumber} is overdue. The outstanding balance is ${outstanding}.`,
      `Due date: ${dueDate}`,
      `Monthly rent: ${monthlyRent}`,
      "Please clear the pending amount at the earliest and confirm once it is paid.",
      "We appreciate your prompt attention.",
      "",
      `Regards,\n${propertyName}`,
    ],
    "payment-confirmation": [
      `Hi ${tenantName},`,
      "",
      `Thank you for your recent payment for ${roomNumber}. We have received the amount successfully.`,
      ...(fields.lastPaymentAmount == null
        ? []
        : [`Paid amount: ${formatCurrency(fields.lastPaymentAmount)}`]),
      `Current outstanding balance: ${outstanding}`,
      "If you have any questions about your rent ledger, please let us know.",
      "Thank you for your continued stay.",
      "",
      `Regards,\n${propertyName}`,
    ],
    "welcome-message": [
      `Hi ${tenantName},`,
      "",
      `Welcome to ${propertyName}! We are glad to have you in room ${roomNumber}.`,
      `Your monthly rent is ${monthlyRent}.`,
      `If you need any help with the room, payments, or stay details, feel free to reach out anytime.`,
      "We look forward to serving you.",
      "",
      `Regards,\n${propertyName}`,
    ],
  };

  return templateMessage[template].join("\n");
}

export function buildWhatsAppLink({
  phone,
  template,
  fields,
  customMessage,
}: {
  phone: string;
  template: ReminderTemplateName;
  fields: ReminderContext;
  customMessage?: string;
}) {
  if (!fields || !validateWhatsAppNumber(phone)) {
    throw new Error(
      "Add a valid Indian mobile number before sending a WhatsApp reminder.",
    );
  }
  const normalizedPhone = normalizeWhatsAppNumber(phone);
  const message = customMessage || buildReminderMessage(template, fields);
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export function getTenantReminderContext(
  s: Snapshot,
  tenantId: string,
  invoiceId?: string,
): ReminderContext | null {
  const tenant = s.tenants.find((item) => item.id === tenantId);
  if (!tenant) return null;

  const occupancy =
    s.occupancies.find((item) => item.tenantId === tenantId && !item.end) ??
    s.occupancies
      .filter((item) => item.tenantId === tenantId)
      .sort((a, b) => b.start.localeCompare(a.start))[0];

  const invoice = invoiceId
    ? s.invoices.find((item) => item.id === invoiceId && item.tenantId === tenantId)
    : s.invoices
        .filter((item) => item.tenantId === tenantId && balance(s, item) > 0)
        .sort((a, b) => a.due.localeCompare(b.due))[0] ??
      s.invoices
        .filter((item) => item.tenantId === tenantId)
        .sort((a, b) => b.due.localeCompare(a.due))[0];

  if (invoiceId && !invoice) return null;
  if (!invoice && !occupancy) return null;

  const bed = occupancy
    ? s.beds.find((item) => item.id === occupancy.bedId)
    : null;
  const room = bed ? s.rooms.find((item) => item.id === bed.roomId) : null;
  const roomNumber = room?.number || bed?.label || "room";
  const lastPayment = s.payments
    .filter((item) => item.tenantId === tenantId)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  return {
    tenantName: tenant.name,
    phone: tenant.phone,
    roomNumber,
    monthlyRent: (occupancy?.rent ?? invoice?.amount ?? 0) / 100,
    outstandingBalance: invoice ? Math.max(0, balance(s, invoice)) / 100 : 0,
    dueDate: invoice?.due || "",
    propertyName: s.settings[0]?.name || "PG Space",
    lastPaymentAmount: lastPayment ? lastPayment.amount / 100 : undefined,
  };
}
