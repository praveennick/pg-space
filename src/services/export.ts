import type { Snapshot, Entities } from "../domain/models";
import { balance } from "../domain/calculations";
import { displayDate, displayMonth } from "../domain/dates";
import headerUrl from "../assets/letterhead/lucky-luxury-header.png";
import footerUrl from "../assets/letterhead/lucky-luxury-footer.png";

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Could not load the payment receipt letterhead."));
    image.src = src;
  });

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
  const [{ jsPDF }, header, footer] = await Promise.all([
    import("jspdf"),
    loadImage(headerUrl),
    loadImage(footerUrl),
  ]);
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const tenant = s.tenants.find((t) => t.id === p.tenantId),
    allocations = s.allocations.filter((a) => a.paymentId === p.id);
  const left = 19;
  const right = 191;
  const dark = [17, 17, 17] as const;
  const gold = [211, 151, 27] as const;
  const white = [255, 255, 255] as const;

  pdf.addImage(header, "PNG", 0, 0, 210, 50);
  pdf.addImage(footer, "PNG", 0, 264.6, 210, 32.4);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...gold);
  pdf.text("PG SPACE / PAYMENT RECEIPT", left, 55);
  pdf.text(
    `Receipt No: ${s.settings[0].receiptPrefix}-${p.id.slice(0, 8).toUpperCase()}`,
    right,
    55,
    { align: "right" },
  );

  pdf.setDrawColor(...gold);
  pdf.setLineWidth(0.35);
  pdf.line(left, 57, right, 57);

  const detailRows = [
    ["Tenant", tenant?.name || "Unknown tenant"],
    ["Date", displayDate(p.date)],
    ["Method", p.method],
    ["Reference", p.reference || "Not provided"],
    ["Amount received", `INR ${(p.amount / 100).toFixed(2)}`],
  ];
  const contentTop = 65;
  const contentBottom = 240;
  let y = contentTop;

  const ensureSpace = (needed: number) => {
    if (y + needed > contentBottom) {
      pdf.addPage();
      pdf.addImage(header, "PNG", 0, 0, 210, 50);
      pdf.addImage(footer, "PNG", 0, 264.6, 210, 32.4);
      y = contentTop;
    }
  };

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...gold);
  pdf.text("Payment details", left, y);
  y += 7;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...dark);
  detailRows.forEach(([label, value]) => {
    ensureSpace(10);
    pdf.text(`${label}:`, left, y);
    const lines = pdf.splitTextToSize(String(value), 108) as string[];
    lines.forEach((line, index) => {
      pdf.text(line, 62, y + index * 4);
    });
    y += Math.max(8, lines.length * 4 + 2);
  });

  ensureSpace(20);
  pdf.setFillColor(...gold);
  pdf.rect(left, y + 2, right - left, 7.5, "F");
  pdf.setTextColor(...white);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text("Allocation / rent applied", left + 3, y + 6.5);
  y += 14;

  if (!allocations.length) {
    ensureSpace(10);
    pdf.setTextColor(...dark);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(
      "Advance money received. It has not been used for rent yet.",
      left + 3,
      y,
    );
    y += 9;
  } else {
    pdf.setTextColor(...dark);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    for (const allocation of allocations) {
      ensureSpace(14);
      const invoice = s.invoices.find((i) => i.id === allocation.invoiceId);
      if (!invoice) continue;
      const occupancy = s.occupancies.find((o) => o.id === invoice.occupancyId);
      const bed = s.beds.find((b) => b.id === occupancy?.bedId);
      const label = `Rent for ${displayMonth(invoice.month)} / Bed ${bed?.label ?? "—"}`;
      pdf.text(label, left + 3, y);
      pdf.text(`INR ${(allocation.amount / 100).toFixed(2)}`, right - 3, y, {
        align: "right",
      });
      y += 6;
      pdf.text(
        `Remaining due: INR ${(balance(s, invoice) / 100).toFixed(2)}`,
        left + 3,
        y,
      );
      y += 8;
    }
  }

  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.2);
  pdf.line(left, 248, right, 248);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...dark);
  pdf.text("Made from records saved in this browser.", left, 256);
  pdf.text(`Total received: INR ${(p.amount / 100).toFixed(2)}`, right, 256, {
    align: "right",
  });

  pdf.save(`receipt-${p.id.slice(0, 8)}.pdf`);
}
