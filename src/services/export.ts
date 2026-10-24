import type { Snapshot, Entities } from "../domain/models";
import { balance } from "../domain/calculations";
import { displayDate, displayMonth } from "../domain/dates";
export function download(
  name: string,
  content: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportCsv(name: string, rows: (string | number)[][]) {
  download(
    name,
    rows
      .map((r) =>
        r
          .map(
            (v) =>
              `"${String(v)
                .replace(/^[=+@-]/, "'$&")
                .replaceAll('"', '""')}"`,
          )
          .join(","),
      )
      .join("\r\n"),
    "text/csv;charset=utf-8",
  );
}
export async function receipt(s: Snapshot, p: Entities["payments"]) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF(),
    tenant = s.tenants.find((t) => t.id === p.tenantId),
    allocations = s.allocations.filter((a) => a.paymentId === p.id);
  pdf.setFontSize(26);
  pdf.text(s.settings[0].name, 20, 25);
  pdf.setFontSize(11);
  pdf.text("PG SPACE / PAYMENT RECEIPT", 20, 37);
  pdf.text(
    `Receipt: ${s.settings[0].receiptPrefix}-${p.id.slice(0, 8).toUpperCase()}`,
    20,
    53,
  );
  const rows = [
    `Tenant: ${tenant?.name}`,
    `Amount received: INR ${(p.amount / 100).toFixed(2)}`,
    `Date: ${displayDate(p.date)}`,
    `Method: ${p.method}`,
    `Reference: ${p.reference || "Not provided"}`,
  ];
  for (const a of allocations) {
    const i = s.invoices.find((i) => i.id === a.invoiceId)!,
      o = s.occupancies.find((o) => o.id === i.occupancyId),
      bed = s.beds.find((b) => b.id === o?.bedId);
    rows.push(
      `Rent for ${displayMonth(i.month)} / Bed ${bed?.label}: INR ${(a.amount / 100).toFixed(2)}`,
      `Rent still due: INR ${(balance(s, i) / 100).toFixed(2)}`,
    );
  }
  if (!allocations.length)
    rows.push("Advance money received. It has not been used for rent yet.");
  rows.forEach((r, i) => pdf.text(r, 20, 68 + i * 10));
  pdf.text("Made from records saved in this browser.", 20, 265);
  pdf.save(`receipt-${p.id.slice(0, 8)}.pdf`);
}
