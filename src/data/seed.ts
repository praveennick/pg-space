import {
  emptySnapshot,
  stamp,
  today,
  monthNow,
  type Snapshot,
} from "../domain/models";
import { format, subMonths } from "date-fns";
import type { DataStore } from "./contracts";
export function demoData(): Snapshot {
  const s = emptySnapshot(),
    now = today(),
    month = monthNow();
  s.settings.push({
    id: "property",
    name: "The Urban Nest",
    address: "Koramangala, Bengaluru",
    phone: "+91 80000 00000",
    email: "hello@example.test",
    floors: 4,
    maxCapacity: 12,
    defaultRent: 850000,
    defaultDeposit: 1500000,
    dueDay: 5,
    graceDays: 0,
    prorate: true,
    receiptPrefix: "PGS",
    notifications: true,
    reducedMotion: false,
  });
  for (let f = 0; f < 4; f++)
    for (let n = 1; n <= 6; n++) {
      const capacity = [1, 2, 3, 4, 6, 7][n - 1],
        room = {
          ...stamp(),
          number: `${f + 1}0${n}`,
          floor: f,
          capacity,
          rent: (11000 - capacity * 650) * 100,
          deposit: 1500000,
          facilities:
            n % 2
              ? ["Wi-Fi", "Wardrobe", "Fan", "Attached Bathroom"]
              : ["AC", "Wi-Fi", "Wardrobe", "Study Table", "Attached Bathroom"],
          description:
            "Bright, thoughtfully furnished room with plenty of natural light.",
          archived: false,
        };
      s.rooms.push(room);
      for (let b = 0; b < capacity; b++)
        s.beds.push({
          ...stamp(),
          roomId: room.id,
          label: `${room.number}-${String.fromCharCode(65 + b)}`,
          position: b,
          rent: null,
          retired: false,
        });
    }
  // Include five-sharing alongside custom seven-sharing rooms.
  const five = s.rooms[4];
  five.capacity = 5;
  s.beds = s.beds.filter((b) => b.roomId !== five.id || b.position < 5);
  const first = [
    "Aarav",
    "Diya",
    "Arjun",
    "Ananya",
    "Kabir",
    "Ishaan",
    "Meera",
    "Rohan",
    "Sara",
    "Vihaan",
    "Aditi",
    "Dev",
    "Nisha",
    "Kiran",
    "Tara",
    "Yash",
  ];
  const last = ["Sharma", "Patel", "Rao", "Mehta", "Kapoor", "Nair"];
  s.beds.forEach((b, index) => {
    if (index % 5 === 0 || index % 11 === 0) return;
    const r = s.rooms.find((r) => r.id === b.roomId)!,
      t = {
        ...stamp(),
        name: `${first[index % first.length]} ${last[index % last.length]} (Demo)`,
        phone: `90000${String(index).padStart(5, "0")}`,
        email: `resident${index}@example.test`,
        address: "Fictional demo address",
        emergency: "9000000000",
        occupation: index % 2 ? "Software engineer" : "Student",
        idMetadata: "Demo metadata only",
        notes: "Fictional resident for demonstration.",
      };
    s.tenants.push(t);
    const o = {
      ...stamp(),
      tenantId: t.id,
      bedId: b.id,
      start: format(subMonths(new Date(`${now}T12:00:00`), 5), "yyyy-MM-01"),
      end: null,
      rent: r.rent,
      deposit: r.deposit,
      dueDay: 5,
      expectedCheckout: index % 13 === 0 ? `${month}-28` : "",
    };
    s.occupancies.push(o);
    s.deposits.push({
      ...stamp(),
      tenantId: t.id,
      occupancyId: o.id,
      type: "Collected",
      amount: r.deposit,
      date: o.start,
      notes: "Demo security deposit",
    });
    for (let m = 5; m >= 0; m--) {
      const mo = format(subMonths(new Date(`${now}T12:00:00`), m), "yyyy-MM"),
        i = {
          ...stamp(),
          tenantId: t.id,
          occupancyId: o.id,
          month: mo,
          due: `${mo}-05`,
          amount: Math.round(r.rent * (1 - m * 0.025)),
          description: "Monthly rent",
        };
      s.invoices.push(i);
      const amount = m
        ? i.amount
        : index % 7 === 0
          ? 0
          : index % 4 === 0
            ? Math.round(i.amount * 0.6)
            : i.amount;
      if (amount) {
        const p = {
          ...stamp(),
          tenantId: t.id,
          amount,
          date: `${mo}-${m ? "04" : String(Math.min(Number(now.slice(8)), 4 + (index % 15))).padStart(2, "0")}`,
          method: "UPI" as const,
          reference: `DEMO-${index}-${mo}`,
          notes: "Seeded demo payment",
          key: `demo-${index}-${mo}`,
        };
        s.payments.push(p);
        s.allocations.push({
          ...stamp(),
          paymentId: p.id,
          invoiceId: i.id,
          amount,
        });
      }
    }
  });
  const vacant = s.beds.filter(
    (b) => !s.occupancies.some((o) => o.bedId === b.id),
  );
  vacant.slice(0, 4).forEach((b, i) =>
    s.reservations.push({
      ...stamp(),
      name: `${first[i]} Prospect (Demo)`,
      phone: "9000000000",
      bedId: b.id,
      checkIn: now,
      expires: now > `${month}-28` ? now : `${month}-28`,
      amount: 200000,
      status: "Confirmed",
      notes: "Demo reservation; booking amount held separately.",
    }),
  );
  vacant.slice(4, 7).forEach((b, i) =>
    s.tickets.push({
      ...stamp(),
      roomId: b.roomId,
      bedId: b.id,
      category: i ? "Plumbing" : "Cleaning",
      description: i
        ? "Repair bathroom tap and check fittings"
        : "Deep cleaning before the next check-in",
      priority: i ? "High" : "Medium",
      status: i ? "Open" : "In Progress",
      block: true,
      resolution: "",
    }),
  );
  for (let m = 5; m >= 0; m--) {
    const mo = format(subMonths(new Date(`${now}T12:00:00`), m), "yyyy-MM");
    ["Electricity", "Groceries", "Salaries", "Internet", "Cleaning"].forEach(
      (category, i) =>
        s.expenses.push({
          ...stamp(),
          title: `${category} · monthly bill`,
          amount: [1850000, 4200000, 5500000, 350000, 650000][i] + m * 12000,
          category,
          date: `${mo}-01`,
          method: "Bank Transfer",
          vendor: "Demo vendor",
          notes: "Fictional operating expense",
          recurring: true,
          receipt: "",
        }),
    );
  }
  s.notifications.push({
    ...stamp(),
    title: "Your PG is ready",
    message:
      "This demo has sample rooms and residents. Open any page to try it.",
    href: "/app/rooms",
    read: false,
  });
  s.audit.push({
    ...stamp(),
    action: "Demo property created",
    detail:
      "24 sample rooms across four floors. All residents and payments are made up for this demo.",
  });
  return s;
}
export async function initialize(store: DataStore) {
  await store.transact((s) => {
    if (!s.settings.length) Object.assign(s, demoData());
  });
}

export async function initializeCloud(store: DataStore) {
  await store.transact((state) => {
    if (state.settings.length) return;
    state.settings.push({
      id: "property",
      name: "My PG",
      address: "",
      phone: "",
      email: "",
      floors: 4,
      maxCapacity: 12,
      defaultRent: 850000,
      defaultDeposit: 1500000,
      dueDay: 5,
      graceDays: 0,
      prorate: true,
      receiptPrefix: "PGS",
      notifications: true,
      reducedMotion: false,
    });
  });
}
