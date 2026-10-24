import { store } from "../data";
import { nextQuotationNumber, type Quotation } from "../domain/quotation";
import { uid, type Entities } from "../domain/models";

export type SavedQuotation = Entities["quotations"];

export async function saveQuotation(
  quotation: Quotation,
  savedId: string | null,
): Promise<SavedQuotation> {
  return store.transact((data) => {
    const existing = data.quotations.find((item) => item.id === savedId);
    const time = new Date().toISOString();
    const saved: SavedQuotation = {
      ...quotation,
      id: existing?.id ?? uid(),
      number:
        existing?.number ??
        nextQuotationNumber(data.quotations, quotation.date),
      createdAt: existing?.createdAt ?? time,
      updatedAt: time,
      items: quotation.items.map((item) => ({ ...item })),
    };
    if (existing) Object.assign(existing, saved);
    else data.quotations.push(saved);
    return saved;
  });
}
