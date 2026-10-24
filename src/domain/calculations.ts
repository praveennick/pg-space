import type { Bed, Snapshot, Entities } from "./models";
import { today } from "./models";
export type BedStatus =
  "Available" | "Occupied" | "Reserved" | "Maintenance" | "Cleaning";
export function activeReservation(r: Entities["reservations"], day = today()) {
  return ["Pending", "Confirmed"].includes(r.status) && r.expires >= day;
}
export function bedStatus(s: Snapshot, bed: Bed): BedStatus {
  if (s.occupancies.some((o) => o.bedId === bed.id && !o.end))
    return "Occupied";
  const ticket = s.tickets.find(
    (t) =>
      t.bedId === bed.id &&
      t.block &&
      !["Resolved", "Closed"].includes(t.status),
  );
  if (ticket)
    return ticket.category === "Cleaning" ? "Cleaning" : "Maintenance";
  if (s.reservations.some((r) => r.bedId === bed.id && activeReservation(r)))
    return "Reserved";
  return "Available";
}
export function activeBeds(s: Snapshot) {
  return s.beds.filter(
    (b) => !b.retired && s.rooms.some((r) => r.id === b.roomId && !r.archived),
  );
}
export function invoicePaid(s: Snapshot, id: string) {
  return s.allocations
    .filter((a) => a.invoiceId === id)
    .reduce((sum, a) => sum + a.amount, 0);
}
export function paymentUnallocated(s: Snapshot, id: string) {
  const payment = s.payments.find((item) => item.id === id);
  return payment
    ? payment.amount -
        s.allocations
          .filter((allocation) => allocation.paymentId === id)
          .reduce((sum, allocation) => sum + allocation.amount, 0)
    : 0;
}
export function balance(s: Snapshot, i: Entities["invoices"]) {
  return i.amount - invoicePaid(s, i.id);
}
export function invoiceStatus(s: Snapshot, i: Entities["invoices"]) {
  const paid = invoicePaid(s, i.id);
  return paid === i.amount
    ? "Paid"
    : i.due < today()
      ? "Overdue"
      : paid
        ? "Partial"
        : "Unpaid";
}
export function depositHeld(s: Snapshot, tenantId?: string) {
  return s.deposits
    .filter((d) => !tenantId || d.tenantId === tenantId)
    .reduce((v, d) => v + (d.type === "Collected" ? d.amount : -d.amount), 0);
}
export function metrics(s: Snapshot, from: string, to: string) {
  const beds = activeBeds(s),
    counts = {
      Available: 0,
      Occupied: 0,
      Reserved: 0,
      Maintenance: 0,
      Cleaning: 0,
    };
  beds.forEach((b) => counts[bedStatus(s, b)]++);
  const invoices = s.invoices.filter(
    (i) => i.month >= from.slice(0, 7) && i.month <= to.slice(0, 7),
  );
  const billed = invoices.reduce((v, i) => v + i.amount, 0),
    collected = invoices.reduce((v, i) => v + invoicePaid(s, i.id), 0);
  const expenses = s.expenses
    .filter((e) => e.date >= from && e.date <= to)
    .reduce((v, e) => v + e.amount, 0);
  const receipts = s.allocations
    .filter((a) =>
      s.payments.some(
        (p) => p.id === a.paymentId && p.date >= from && p.date <= to,
      ),
    )
    .reduce((v, a) => v + a.amount, 0);
  const operational = beds.length - counts.Maintenance - counts.Cleaning;
  return {
    counts,
    total: beds.length,
    rooms: s.rooms.filter((r) => !r.archived).length,
    occupancy: operational
      ? Math.round((counts.Occupied / operational) * 100)
      : 0,
    billed,
    collected,
    pending: billed - collected,
    overdue: invoices
      .filter((i) => i.due < today())
      .reduce((v, i) => v + balance(s, i), 0),
    expenses,
    cash: receipts - expenses,
    receipts,
  };
}
