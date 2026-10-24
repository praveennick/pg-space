import type { Quotation } from "../domain/quotation";
import { displayDate } from "../domain/dates";
import {
  accommodationName,
  amountInWords,
  quotationTotal,
} from "../domain/quotation";
import headerUrl from "../assets/letterhead/lucky-luxury-header.png";
import footerUrl from "../assets/letterhead/lucky-luxury-footer.png";

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Could not load the quotation letterhead."));
    image.src = src;
  });

const gold = [211, 151, 27] as const;
const dark = [17, 17, 17] as const;
const white = [255, 255, 255] as const;

export async function quotationPdf(quotation: Quotation) {
  const [{ jsPDF }, header, footer] = await Promise.all([
    import("jspdf"),
    loadImage(headerUrl),
    loadImage(footerUrl),
  ]);
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const left = 19,
    right = 191,
    bottom = 252;
  let y = 62,
    page = 0;
  const font = (
    size: number,
    bold = false,
    color: readonly number[] = dark,
  ) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(color[0], color[1], color[2]);
  };
  const frame = () => {
    if (page++) pdf.addPage();
    pdf.addImage(header, "PNG", 0, 0, 210, 50);
    pdf.addImage(footer, "PNG", 0, 264.6, 210, 32.4);
    y = 62;
  };
  const ensure = (height: number) => {
    if (y + height > bottom) frame();
  };
  const write = (
    text: string,
    x: number,
    width: number,
    size = 9,
    bold = false,
    color: readonly number[] = dark,
    leading = 4.5,
  ) => {
    font(size, bold, color);
    const lines = pdf.splitTextToSize(text || " ", width) as string[];
    for (const part of lines) {
      ensure(leading);
      pdf.text(part, x, y);
      y += leading;
    }
  };
  const imageText = (
    label: string,
    alignRight: number,
    baseline: number,
    size = 8,
    bold = false,
    color = "#111111",
  ) => {
    // The built-in PDF fonts omit the rupee glyph. Render the currency figure
    // at high resolution so it displays correctly on phones and in print.
    const scale = 4;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not render the quotation currency.");
    const pixels = size * (96 / 72);
    context.font = `${bold ? 700 : 400} ${pixels * scale}px Arial, sans-serif`;
    canvas.width = Math.ceil(context.measureText(label).width + 8 * scale);
    canvas.height = Math.ceil(pixels * 1.45 * scale);
    context.font = `${bold ? 700 : 400} ${pixels * scale}px Arial, sans-serif`;
    context.fillStyle = color;
    context.textBaseline = "alphabetic";
    context.fillText(label, 2 * scale, pixels * scale);
    const width = (canvas.width / scale) * (25.4 / 96);
    const height = (canvas.height / scale) * (25.4 / 96);
    pdf.addImage(
      canvas,
      "PNG",
      alignRight - width,
      baseline - pixels * (25.4 / 96),
      width,
      height,
    );
  };
  const currency = (
    value: number,
    alignRight: number,
    baseline: number,
    size = 8,
    bold = false,
    color = "#111111",
  ) =>
    imageText(
      `₹${value.toLocaleString("en-IN")}`,
      alignRight,
      baseline,
      size,
      bold,
      color,
    );
  const columns = [15, 48, 90, 128, 166, 195];
  const tableHeader = () => {
    ensure(10);
    pdf.setFillColor(...gold);
    pdf.rect(columns[0], y, columns[5] - columns[0], 9.5, "F");
    font(7.5, true, white);
    const labels = [
      "S.No",
      "Accommodation",
      "Persons / Slots",
      "Rate / Person / Month",
      "Amount / Month",
    ];
    labels.forEach((label, index) =>
      pdf.text(label, (columns[index] + columns[index + 1]) / 2, y + 6.2, {
        align: "center",
      }),
    );
    pdf.setDrawColor(...white);
    pdf.setLineWidth(0.2);
    columns.slice(1, -1).forEach((x) => pdf.line(x, y, x, y + 9.5));
    y += 9.5;
  };

  frame();
  font(17, true);
  pdf.text("QUOTATION", 105, y + 4, { align: "center" });
  pdf.setDrawColor(...gold);
  pdf.setLineWidth(0.4);
  pdf.line(82, y + 11, 128, y + 11);
  y += 19;

  // Match the reference's recipient and quote-number columns.
  font(8.7, true, gold);
  pdf.text("To:", left, y);
  font(8.7, true);
  const recipientLines = pdf.splitTextToSize(
    quotation.recipient.trim(),
    90,
  ) as string[];
  recipientLines.forEach((part, index) =>
    pdf.text(part, left + 5.5, y + index * 4),
  );
  font(7.4);
  const number = quotation.number.trim();
  const numberWidth = pdf.getTextWidth(number);
  font(7.4, true, gold);
  pdf.text("Quotation No:", right - numberWidth - 1.5, y, { align: "right" });
  font(7.4);
  pdf.text(number, right, y, { align: "right" });
  y += Math.max(5, recipientLines.length * 4);
  font(8);
  const addressLines = pdf.splitTextToSize(
    quotation.address.trim() || " ",
    105,
  ) as string[];
  const addressY = y;
  addressLines.forEach((part, index) =>
    pdf.text(part, left, addressY + index * 4),
  );
  font(8.2, true, gold);
  pdf.text("Date:", right - 29, y);
  font(8.2);
  pdf.text(displayDate(quotation.date), right, y, { align: "right" });
  y += Math.max(5, addressLines.length * 4);
  font(8.2, true, gold);
  pdf.text("Subject:", left, y);
  font(8.2, true);
  const subjectLines = pdf.splitTextToSize(
    quotation.subject.trim(),
    103,
  ) as string[];
  subjectLines.forEach((part, index) =>
    pdf.text(part, left + 12.5, y + index * 4),
  );
  font(8.2, true, gold);
  pdf.text("Currency:", right - 31, y);
  imageText("INR (₹)", right, y, 8.2);
  y += Math.max(6, subjectLines.length * 4 + 2);
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.2);
  pdf.line(left, y, right, y);
  y += 5;
  write("Dear Sir/Madam,", left, right - left, 8.7, true, dark, 5);
  y += 2;
  write(
    quotation.introduction.trim(),
    left,
    right - left,
    8.5,
    false,
    dark,
    4.5,
  );
  y += 3;

  tableHeader();
  quotation.items.forEach((item, index) => {
    font(8);
    const description = pdf.splitTextToSize(
      accommodationName(item.accommodation),
      39,
    ) as string[];
    const height = Math.max(9.5, description.length * 4 + 4);
    if (y + height > bottom) {
      frame();
      tableHeader();
    }
    const shade = index % 2 === 0 ? [255, 255, 255] : [251, 248, 242];
    pdf.setFillColor(shade[0], shade[1], shade[2]);
    pdf.rect(columns[0], y, columns[5] - columns[0], height, "F");
    pdf.setDrawColor(224, 215, 199);
    pdf.setLineWidth(0.16);
    columns.forEach((x) => pdf.line(x, y, x, y + height));
    pdf.line(columns[0], y + height, columns[5], y + height);
    font(8);
    pdf.text(String(index + 1), (columns[0] + columns[1]) / 2, y + 6.2, {
      align: "center",
    });
    pdf.text(description, columns[1] + 1.5, y + 6.2);
    pdf.text(String(item.persons), (columns[2] + columns[3]) / 2, y + 6.2, {
      align: "center",
    });
    currency(item.rate, columns[4] - 2, y + 6.2, 8);
    currency(item.persons * item.rate, columns[5] - 2, y + 6.2, 8, true);
    y += height;
  });
  ensure(11);
  pdf.setFillColor(...dark);
  pdf.rect(columns[0], y, columns[5] - columns[0], 10, "F");
  font(8.5, true, white);
  pdf.text("TOTAL MONTHLY AMOUNT", columns[4] - 2, y + 6.5, { align: "right" });
  const total = quotationTotal(quotation.items);
  currency(total, columns[5] - 2, y + 6.5, 8.5, true, "#e7ab24");
  y += 14;
  ensure(8);
  font(8.2, true, gold);
  pdf.text("Amount in words:", left, y);
  font(8.2, true);
  const amountLines = pdf.splitTextToSize(
    `${amountInWords(total)} per month.`,
    right - left - 27,
  ) as string[];
  amountLines.forEach((part, index) =>
    pdf.text(part, left + 27, y + index * 4),
  );
  y += Math.max(5, amountLines.length * 4);

  const notes = quotation.notes
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
  const detail = `Quotation is calculated for ${quotation.items
    .map(
      (item) =>
        `${item.persons} ${item.persons === 1 ? "person" : "persons"} in ${accommodationName(
          item.accommodation,
        )
          .toLowerCase()
          .replace(/\s+sharing$/i, "-sharing")}`,
    )
    .join(" and ")}.`;
  if (
    !notes.some((note) =>
      note.toLowerCase().startsWith("quotation is calculated for"),
    )
  )
    notes.splice(Math.min(1, notes.length), 0, detail);
  font(7.7);
  const noteLines = notes.flatMap(
    (note) => pdf.splitTextToSize(`• ${note}`, right - left - 8) as string[],
  );
  let cursor = 0;
  while (cursor < noteLines.length) {
    ensure(12);
    const count = Math.min(
      noteLines.length - cursor,
      Math.max(1, Math.floor((bottom - y - 10) / 4)),
    );
    const boxHeight = 8 + count * 4;
    pdf.setDrawColor(...gold);
    pdf.setLineWidth(0.35);
    pdf.rect(left, y, right - left, boxHeight);
    font(8.2, true, gold);
    pdf.text("Notes / Inclusions", left + 2.5, y + 5);
    font(7.7);
    for (let index = 0; index < count; index++)
      pdf.text(noteLines[cursor + index], left + 3, y + 9 + index * 4);
    cursor += count;
    y += boxHeight + 4;
    if (cursor < noteLines.length) frame();
  }

  ensure(20);
  if (quotation.closing.trim())
    write(quotation.closing.trim(), left, right - left, 8.2, false, dark, 4);
  y += 2;
  ensure(12);
  font(8.2);
  pdf.text("For any clarification, please contact:", left, y);
  font(8.2, true);
  pdf.text("7801095555 / 8142238888", left, y + 4);
  font(8.2, true, gold);
  pdf.text("For Lucky Luxury Men's PG", right, y, { align: "right" });
  font(8.2);
  pdf.text(quotation.signatory.trim(), right, y + 8, { align: "right" });
  pdf.save(`quotation-${quotation.number.replace(/[^a-z0-9-]/gi, "-")}.pdf`);
}
