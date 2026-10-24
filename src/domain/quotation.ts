import { today, uid, type Entities } from "./models";

export type QuotationItem = {
  id: string;
  accommodation: string;
  persons: number;
  rate: number;
};

export type Quotation = {
  number: string;
  date: string;
  recipient: string;
  address: string;
  subject: string;
  introduction: string;
  items: QuotationItem[];
  notes: string;
  closing: string;
  signatory: string;
};

export const quotationYear = (date: string) => {
  const parsed = new Date(`${date}T12:00:00`);
  const financialYear =
    parsed.getMonth() >= 3 ? parsed.getFullYear() : parsed.getFullYear() - 1;
  return `${financialYear}-${String((financialYear + 1) % 100).padStart(2, "0")}`;
};

export const nextQuotationNumber = (
  saved: Pick<Entities["quotations"], "number">[],
  date = today(),
) => {
  const prefix = `LLPG/QTN/${quotationYear(date)}/`;
  const highest = saved.reduce((max, quotation) => {
    if (!quotation.number.startsWith(prefix)) return max;
    const suffix = quotation.number.slice(prefix.length);
    return /^\d+$/.test(suffix) ? Math.max(max, Number(suffix)) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(3, "0")}`;
};

export const newQuotation = (number = nextQuotationNumber([])): Quotation => {
  const localDate = today();
  return {
    number,
    date: localDate,
    recipient: "",
    address: "",
    subject: "Quotation for Men's PG Accommodation",
    introduction:
      "Thank you for your enquiry. We are pleased to offer the following monthly accommodation rates at Lucky Luxury Men's PG:",
    items: [
      {
        id: uid(),
        accommodation: "",
        persons: 1,
        rate: 0,
      },
    ],
    notes:
      "Rates are per person per month.\nWi-Fi, CCTV security, homely food, washing machine, 24/7 hot & cold water and safe & secure accommodation are included.\nAccommodation is subject to availability at the time of confirmation.",
    closing: "We look forward to serving your team.",
    signatory: "Authorized Signatory",
  };
};

export const quotationTotal = (items: QuotationItem[]) =>
  items.reduce((sum, item) => sum + item.persons * item.rate, 0);

export function accommodationName(value: string): string {
  const name = value.trim();
  const sharing = name.match(/^(\d+)\s*(?:[- ]\s*sharing)?$/i);
  return sharing ? `${Number(sharing[1])} Sharing` : name;
}

const small = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const tens = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];
function underThousand(value: number): string {
  const parts: string[] = [];
  if (value >= 100) {
    parts.push(`${small[Math.floor(value / 100)]} Hundred`);
    value %= 100;
  }
  if (value >= 20) {
    parts.push(
      `${tens[Math.floor(value / 10)]}${value % 10 ? `-${small[value % 10]}` : ""}`,
    );
  } else if (value) {
    parts.push(small[value]);
  }
  return parts.join(" ");
}
export function amountInWords(amount: number): string {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 99_99_99_999)
    return "";
  if (amount === 0) return "Rupees Zero Only";
  const parts: string[] = [];
  for (const [divisor, label] of [
    [1_00_00_000, "Crore"],
    [1_00_000, "Lakh"],
    [1_000, "Thousand"],
  ] as const) {
    const chunk = Math.floor(amount / divisor);
    if (chunk) parts.push(`${underThousand(chunk)} ${label}`);
    amount %= divisor;
  }
  if (amount) parts.push(underThousand(amount));
  return `Rupees ${parts.join(" ")} Only`;
}
