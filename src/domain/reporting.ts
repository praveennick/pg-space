import type { Snapshot } from "./models";
/** Room-scoped operational/financial records; property-wide expenses remain unallocated. */
export function scopeRooms(
  s: Snapshot,
  floor = "all",
  room = "all",
  sharing = "all",
): Snapshot {
  const rooms = s.rooms.filter(
    (r) =>
      (floor === "all" || r.floor === Number(floor)) &&
      (room === "all" || r.id === room) &&
      (sharing === "all" || r.capacity === Number(sharing)),
  );
  const beds = s.beds.filter((b) => rooms.some((r) => r.id === b.roomId)),
    occupancies = s.occupancies.filter((o) =>
      beds.some((b) => b.id === o.bedId),
    ),
    invoices = s.invoices.filter((i) =>
      occupancies.some((o) => o.id === i.occupancyId),
    ),
    allocations = s.allocations.filter((a) =>
      invoices.some((i) => i.id === a.invoiceId),
    );
  return {
    ...s,
    rooms,
    beds,
    occupancies,
    invoices,
    allocations,
    deposits: s.deposits.filter((d) =>
      occupancies.some((o) => o.id === d.occupancyId),
    ),
  };
}
