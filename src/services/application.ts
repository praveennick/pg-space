import {
  schemas,
  stamp,
  today,
  monthNow,
  names,
  emptySnapshot,
  type Snapshot,
  type Room,
  type Tenant,
  type Settings,
  type Entities,
} from "../domain/models";
import {
  activeBeds,
  activeReservation,
  bedStatus,
  balance,
  depositHeld,
} from "../domain/calculations";
import type { DataStore } from "../data/contracts";
const log = (s: Snapshot, action: string, detail: string) => {
  s.audit.push({ ...stamp(), action, detail });
  if (s.settings[0]?.notifications)
    s.notifications.push({
      ...stamp(),
      title: action,
      message: detail,
      href: /Room|Bed/.test(action)
        ? "/app/rooms"
        : /Tenant/.test(action)
          ? "/app/tenants"
          : /Payment|Advance|Deposit|billing|Rent bill/.test(action)
            ? "/app/payments"
            : /Expense/.test(action)
              ? "/app/expenses"
              : /Reservation/.test(action)
                ? "/app/reservations"
                : /Maintenance|Repair/.test(action)
                  ? "/app/maintenance"
                  : "/app/settings",
      read: false,
    });
};
function available(s: Snapshot, id: string) {
  const bed = activeBeds(s).find((b) => b.id === id);
  if (!bed) throw new Error("This bed is not available. Choose a free bed.");
  if (bedStatus(s, bed) !== "Available")
    throw new Error(
      `This bed is ${bedStatus(s, bed).toLowerCase()}. Choose a free bed.`,
    );
  return bed;
}
function bill(s: Snapshot, month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
    throw new Error("Choose a valid rent month.");
  const [year, mon] = month.split("-").map(Number),
    days = new Date(year, mon, 0).getDate(),
    last = `${month}-${days}`;
  for (const o of s.occupancies.filter(
    (o) => o.start <= last && (!o.end || o.end >= `${month}-01`),
  )) {
    if (s.invoices.some((i) => i.tenantId === o.tenantId && i.month === month))
      continue;
    const start = o.start.slice(0, 7) === month ? Number(o.start.slice(8)) : 1,
      end = o.end?.slice(0, 7) === month ? Number(o.end.slice(8)) : days;
    const amount = s.settings[0].prorate
      ? Math.round((o.rent * Math.max(0, end - start + 1)) / days)
      : o.rent;
    s.invoices.push({
      ...stamp(),
      tenantId: o.tenantId,
      occupancyId: o.id,
      month,
      due: `${month}-${String(o.dueDay).padStart(2, "0")}`,
      amount,
      description: s.settings[0].prorate
        ? "Rent for the days stayed"
        : "Monthly rent",
    });
  }
}
export class ApplicationService {
  store: DataStore;
  constructor(store: DataStore) {
    this.store = store;
  }
  async saveRoom(input: Room) {
    const room = schemas.rooms.parse(input);
    return this.store.transact((s) => {
      if (room.capacity > s.settings[0].maxCapacity)
        throw new Error(
          `A room can have up to ${s.settings[0].maxCapacity} beds.`,
        );
      if (room.floor >= s.settings[0].floors)
        throw new Error("Choose a floor listed in Settings.");
      if (
        s.rooms.some(
          (r) =>
            r.number.toLowerCase() === room.number.toLowerCase() &&
            r.id !== room.id,
        )
      )
        throw new Error(
          "This room number is already used, even by a hidden room.",
        );
      const old = s.rooms.find((r) => r.id === room.id),
        beds = s.beds
          .filter((b) => b.roomId === room.id && !b.retired)
          .sort((a, b) => a.position - b.position);
      const retiring = beds.slice(room.capacity);
      for (const b of retiring)
        if (bedStatus(s, b) !== "Available")
          throw new Error(
            `Bed ${b.label} is not free. Free it before removing it.`,
          );
      retiring.forEach((b) => (b.retired = true));
      if (old) Object.assign(old, room);
      else s.rooms.push(room);
      for (let pos = beds.length; pos < room.capacity; pos++)
        s.beds.push({
          ...stamp(),
          roomId: room.id,
          label: `${room.number}-${String.fromCharCode(65 + pos)}`,
          position: pos,
          rent: null,
          retired: false,
        });
      s.beds
        .filter((b) => b.roomId === room.id && !b.retired)
        .forEach(
          (b) =>
            (b.label = `${room.number}-${String.fromCharCode(65 + b.position)}`),
        );
      log(
        s,
        old ? "Room updated" : "Room created",
        `Room ${room.number} · ${room.capacity} beds`,
      );
      return room.id;
    });
  }
  async archiveRoom(id: string) {
    return this.store.transact((s) => {
      const r = s.rooms.find((r) => r.id === id);
      if (!r) throw new Error("Room not found");
      if (
        s.beds.some(
          (b) =>
            b.roomId === id && !b.retired && bedStatus(s, b) !== "Available",
        )
      )
        throw new Error("Free all beds in this room before hiding it.");
      r.archived = true;
      log(s, "Room hidden", r.number);
    });
  }
  async bedRent(id: string, rent: number | null) {
    return this.store.transact((s) => {
      const b = s.beds.find((b) => b.id === id);
      if (!b) throw new Error("Bed not found");
      b.rent = rent;
      schemas.beds.parse(b);
      log(s, "Bed rent updated", b.label);
    });
  }
  async checkIn(
    tenant: Tenant,
    input: {
      bedId: string;
      start: string;
      rent: number;
      deposit: number;
      dueDay: number;
      expectedCheckout: string;
    },
    reservationId?: string,
  ) {
    return this.store.transact((s) => {
      const t = schemas.tenants.parse(tenant);
      if (s.occupancies.some((o) => o.tenantId === t.id && !o.end))
        throw new Error("Tenant already has an active stay.");
      if (input.start > today())
        throw new Error("Use a reservation for a future check-in.");
      if (reservationId) {
        const r = s.reservations.find((r) => r.id === reservationId);
        if (
          !r ||
          !activeReservation(r) ||
          r.status !== "Confirmed" ||
          r.bedId !== input.bedId
        )
          throw new Error("Reservation is not eligible for check-in.");
        r.status = "Checked In";
      }
      available(s, input.bedId);
      const o = schemas.occupancies.parse({
        ...stamp(),
        tenantId: t.id,
        ...input,
        end: null,
      });
      if (o.expectedCheckout && o.expectedCheckout < o.start)
        throw new Error("Expected checkout must follow check-in.");
      const existing = s.tenants.find((v) => v.id === t.id);
      if (existing) Object.assign(existing, t);
      else s.tenants.push(t);
      s.occupancies.push(o);
      bill(s, o.start.slice(0, 7));
      log(
        s,
        "Tenant checked in",
        `${t.name} · ${s.beds.find((b) => b.id === o.bedId)?.label}`,
      );
      return t.id;
    });
  }
  async editTenant(tenant: Tenant) {
    const t = schemas.tenants.parse(tenant);
    return this.store.transact((s) => {
      const old = s.tenants.find((v) => v.id === t.id);
      if (!old) throw new Error("Tenant not found");
      if (!t.photo) delete old.photo;
      Object.assign(old, t);
      log(s, "Tenant updated", t.name);
    });
  }
  async transfer(
    tenantId: string,
    bedId: string,
    date: string,
    cleaning: boolean,
  ) {
    return this.store.transact((s) => {
      const o = s.occupancies.find((o) => o.tenantId === tenantId && !o.end);
      if (!o) throw new Error("No active stay");
      available(s, bedId);
      if (date < o.start || date > today())
        throw new Error("Transfer date must be between check-in and today.");
      o.end = date;
      s.occupancies.push({ ...o, ...stamp(), bedId, start: date, end: null });
      if (cleaning) this.addCleaning(s, o.bedId);
      log(
        s,
        "Tenant transferred",
        `${s.tenants.find((t) => t.id === tenantId)?.name} moved to ${s.beds.find((b) => b.id === bedId)?.label}. Old rent bills stay the same. Check the rent for this month.`,
      );
    });
  }
  private addCleaning(s: Snapshot, bedId: string) {
    const b = s.beds.find((b) => b.id === bedId)!;
    s.tickets.push({
      ...stamp(),
      roomId: b.roomId,
      bedId,
      category: "Cleaning",
      description: "Prepare bed after tenant departure",
      priority: "Medium",
      status: "Open",
      block: true,
      resolution: "",
    });
  }
  async checkout(
    tenantId: string,
    date: string,
    cleaning: boolean,
    notes: string,
  ) {
    return this.store.transact((s) => {
      const o = s.occupancies.find((o) => o.tenantId === tenantId && !o.end);
      if (!o) throw new Error("No active occupancy");
      if (date < o.start || date > today())
        throw new Error("Checkout date must be between check-in and today.");
      o.end = date;
      if (cleaning) this.addCleaning(s, o.bedId);
      log(
        s,
        "Tenant checked out",
        `${s.tenants.find((t) => t.id === tenantId)?.name}. ${notes}. Record any deposit money kept or returned in Deposit history.`,
      );
    });
  }
  async generateInvoices(month: string) {
    return this.store.transact((s) => {
      bill(s, month);
      log(s, "Rent bills created", month);
    });
  }
  async payment(input: Entities["payments"], invoiceId?: string) {
    const payment = schemas.payments.parse(input);
    return this.store.transact((s) => {
      if (s.payments.some((p) => p.key === payment.key))
        throw new Error("This payment was already processed.");
      if (
        payment.reference &&
        s.payments.some((p) => p.reference === payment.reference)
      )
        throw new Error("This payment reference was used before.");
      if (payment.date > today())
        throw new Error("Payment date cannot be in the future.");
      if (!s.tenants.some((t) => t.id === payment.tenantId))
        throw new Error("Tenant not found");
      if (invoiceId) {
        const i = s.invoices.find((i) => i.id === invoiceId);
        if (!i || i.tenantId !== payment.tenantId)
          throw new Error("This rent bill belongs to another resident.");
        if (payment.amount > balance(s, i))
          throw new Error("The amount is more than the rent still due.");
        s.allocations.push({
          ...stamp(),
          paymentId: payment.id,
          invoiceId,
          amount: payment.amount,
        });
      }
      s.payments.push(payment);
      log(
        s,
        invoiceId ? "Payment recorded" : "Advance received",
        `${s.tenants.find((t) => t.id === payment.tenantId)?.name} · INR ${(payment.amount / 100).toFixed(2)}`,
      );
    });
  }
  async allocate(paymentId: string, invoiceId: string, amount: number) {
    return this.store.transact((s) => {
      const p = s.payments.find((p) => p.id === paymentId),
        i = s.invoices.find((i) => i.id === invoiceId);
      if (!p || !i || p.tenantId !== i.tenantId)
        throw new Error("Choose one of this resident’s rent bills.");
      const remaining =
        p.amount -
        s.allocations
          .filter((a) => a.paymentId === p.id)
          .reduce((v, a) => v + a.amount, 0);
      if (
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        amount > remaining ||
        amount > balance(s, i)
      )
        throw new Error(
          "This amount is more than the advance money or rent due.",
        );
      s.allocations.push({ ...stamp(), paymentId, invoiceId, amount });
      log(s, "Advance used for rent", i.month);
    });
  }
  async deposit(input: Entities["deposits"]) {
    const d = schemas.deposits.parse(input);
    return this.store.transact((s) => {
      if (
        !s.occupancies.some(
          (o) => o.id === d.occupancyId && o.tenantId === d.tenantId,
        )
      )
        throw new Error("Invalid stay");
      if (d.type !== "Collected" && d.amount > depositHeld(s, d.tenantId))
        throw new Error("This amount is more than the deposit you hold.");
      s.deposits.push(d);
      log(s, `Deposit ${d.type.toLowerCase()}`, d.notes);
    });
  }
  async expense(input: Entities["expenses"]) {
    const e = schemas.expenses.parse(input);
    return this.store.transact((s) => {
      const old = s.expenses.find((v) => v.id === e.id);
      if (old) Object.assign(old, e);
      else s.expenses.push(e);
      log(s, "Expense saved", e.title);
    });
  }
  async reservation(input: Entities["reservations"]) {
    const r = schemas.reservations.parse(input);
    return this.store.transact((s) => {
      if (r.expires < today() || r.checkIn < today() || r.expires < r.checkIn)
        throw new Error(
          "Check-in must be today or later; expiry must cover check-in.",
        );
      available(s, r.bedId);
      s.reservations.push(r);
      log(s, "Reservation created", r.name);
    });
  }
  async reservationStatus(id: string, status: "Confirmed" | "Cancelled") {
    return this.store.transact((s) => {
      const r = s.reservations.find((r) => r.id === id);
      if (!r || !activeReservation(r))
        throw new Error("Reservation is no longer active.");
      r.status = status;
      log(s, `Reservation ${status.toLowerCase()}`, r.name);
    });
  }
  async ticket(input: Entities["tickets"]) {
    const t = schemas.tickets.parse(input);
    return this.store.transact((s) => {
      if (!s.rooms.some((r) => r.id === t.roomId && !r.archived))
        throw new Error("Choose an active room");
      if (
        t.bedId &&
        !s.beds.some(
          (b) => b.id === t.bedId && b.roomId === t.roomId && !b.retired,
        )
      )
        throw new Error("Bed must belong to the room");
      if (t.block) {
        if (!t.bedId) throw new Error("Select a bed to block");
        available(s, t.bedId);
      }
      s.tickets.push(t);
      log(s, "Repair request added", t.description);
    });
  }
  async ticketStatus(
    id: string,
    status: Entities["tickets"]["status"],
    resolution: string,
  ) {
    return this.store.transact((s) => {
      const t = s.tickets.find((t) => t.id === id);
      if (!t) throw new Error("Ticket missing");
      t.status = status;
      t.resolution = resolution;
      if (["Resolved", "Closed"].includes(status)) t.block = false;
      log(s, "Repair request updated", `${t.description} · ${status}`);
    });
  }
  async settings(input: Settings) {
    const settings = schemas.settings.parse(input);
    return this.store.transact((s) => {
      if (
        s.rooms.some(
          (r) =>
            !r.archived &&
            (r.floor >= settings.floors || r.capacity > settings.maxCapacity),
        )
      )
        throw new Error(
          "Some rooms have more floors or beds than these new settings allow.",
        );
      s.settings = [settings];
      log(s, "Settings updated", settings.name);
    });
  }
  async markRead(id?: string) {
    return this.store.transact((s) => {
      s.notifications
        .filter((n) => !id || n.id === id)
        .forEach((n) => (n.read = true));
    });
  }
  async recordReminderOpened(
    tenantId: string,
    template: string,
    phone: string,
    message: string,
  ) {
    return this.store.transact((s) => {
      const tenant = s.tenants.find((t) => t.id === tenantId);
      if (!tenant) throw new Error("Tenant not found");
      const detail = `${tenant.name} · ${template} • ${phone || "mobile number not saved"}`;
      s.audit.push({
        ...stamp(),
        action: "Opened WhatsApp",
        detail,
      });
      if (s.settings[0]?.notifications) {
        s.notifications.push({
          ...stamp(),
          title: "Opened WhatsApp",
          message: `Prepared a ${template.toLowerCase()} reminder for ${tenant.name}. ${message.slice(0, 140)}${message.length > 140 ? "…" : ""}`,
          href: `/app/tenants/${tenant.id}`,
          read: false,
        });
      }
    });
  }
  async export() {
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      data: await this.store.read(),
    };
  }
  async import(value: unknown) {
    const s = validateBackup(value);
    await this.store.replace(s);
  }
}
export function validateBackup(value: unknown): Snapshot {
  const root = value as { version?: number; data?: Record<string, unknown> };
  if (![1, 2].includes(root?.version ?? 0) || !root.data)
    throw new Error("This is not a PG Space backup file.");
  const s = emptySnapshot();
  for (const n of names) {
    const rows = schemas[n]
      .array()
      .parse(
        n === "quotations" && root.version === 1
          ? (root.data[n] ?? [])
          : root.data[n],
      );
    if (new Set(rows.map((r) => r.id)).size !== rows.length)
      throw new Error(`This backup has repeated ${n} records.`);
    (s[n] as unknown[]) = rows;
  }
  if (s.settings.length !== 1)
    throw new Error("This backup needs one set of PG settings.");
  if (new Set(s.quotations.map((q) => q.number)).size !== s.quotations.length)
    throw new Error("This backup has repeated quotation numbers.");
  const ref = (name: keyof Snapshot, id: string) =>
    s[name].some((r) => r.id === id);
  const check = (ok: boolean) => {
    if (!ok)
      throw new Error(
        "This backup has missing or conflicting records and cannot be used.",
      );
  };
  check(
    new Set(s.rooms.map((r) => r.number.toLowerCase())).size === s.rooms.length,
  );
  for (const r of s.rooms)
    check(
      r.archived ||
        (r.floor < s.settings[0].floors &&
          r.capacity <= s.settings[0].maxCapacity &&
          s.beds.filter((b) => b.roomId === r.id && !b.retired).length ===
            r.capacity),
    );
  for (const b of s.beds) check(ref("rooms", b.roomId));
  for (const o of s.occupancies) {
    check(
      ref("tenants", o.tenantId) &&
        ref("beds", o.bedId) &&
        (!o.end || o.end >= o.start),
    );
    if (!o.end)
      check(
        activeBeds(s).some((b) => b.id === o.bedId) &&
          s.occupancies.filter(
            (v) => !v.end && (v.bedId === o.bedId || v.tenantId === o.tenantId),
          ).length === 1,
      );
  }
  for (const r of s.reservations) {
    check(ref("beds", r.bedId) && r.expires >= r.checkIn);
    if (activeReservation(r))
      check(activeBeds(s).some((b) => b.id === r.bedId));
  }
  for (const r of s.rooms) {
    const beds = s.beds.filter((b) => b.roomId === r.id && !b.retired);
    check(
      new Set(beds.map((b) => b.position)).size === beds.length &&
        beds.every((b) => b.position < r.capacity),
    );
  }
  for (const t of s.tickets)
    if (t.block && !["Resolved", "Closed"].includes(t.status))
      check(activeBeds(s).some((b) => b.id === t.bedId));
  for (const b of activeBeds(s)) {
    const active =
      s.occupancies.filter((o) => o.bedId === b.id && !o.end).length +
      s.reservations.filter((r) => r.bedId === b.id && activeReservation(r))
        .length +
      s.tickets.filter(
        (t) =>
          t.bedId === b.id &&
          t.block &&
          !["Closed", "Resolved"].includes(t.status),
      ).length;
    check(active <= 1);
  }
  for (const t of s.tickets)
    check(
      ref("rooms", t.roomId) &&
        (!t.bedId ||
          s.beds.some((b) => b.id === t.bedId && b.roomId === t.roomId)),
    );
  check(
    new Set(s.invoices.map((i) => `${i.tenantId}:${i.month}`)).size ===
      s.invoices.length,
  );
  for (const i of s.invoices)
    check(
      s.occupancies.some(
        (o) => o.id === i.occupancyId && o.tenantId === i.tenantId,
      ) && balance(s, i) >= 0,
    );
  check(new Set(s.payments.map((p) => p.key)).size === s.payments.length);
  const refs = s.payments.map((p) => p.reference).filter(Boolean);
  check(new Set(refs).size === refs.length);
  for (const p of s.payments)
    check(
      ref("tenants", p.tenantId) &&
        s.allocations
          .filter((a) => a.paymentId === p.id)
          .reduce((v, a) => v + a.amount, 0) <= p.amount,
    );
  for (const a of s.allocations) {
    const p = s.payments.find((p) => p.id === a.paymentId),
      i = s.invoices.find((i) => i.id === a.invoiceId);
    check(!!p && !!i && p.tenantId === i.tenantId);
  }
  for (const d of s.deposits)
    check(
      s.occupancies.some(
        (o) => o.id === d.occupancyId && o.tenantId === d.tenantId,
      ),
    );
  for (const t of s.tenants) check(depositHeld(s, t.id) >= 0);
  return s;
}
export { monthNow };
