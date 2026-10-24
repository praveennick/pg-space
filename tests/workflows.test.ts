import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { LocalStore } from "../src/data/local";
import {
  ApplicationService,
  validateBackup,
} from "../src/services/application";
import {
  emptySnapshot,
  stamp,
  today,
  monthNow,
  uid,
} from "../src/domain/models";
import { demoData } from "../src/data/seed";
import { bedStatus, balance, metrics } from "../src/domain/calculations";
let store: LocalStore, service: ApplicationService;
const room = () => ({
  ...stamp(),
  number: "TEST-101",
  floor: 0,
  capacity: 3,
  rent: 800000,
  deposit: 1000000,
  facilities: ["Wi-Fi"],
  description: "Test room",
  archived: false,
});
const tenant = () => ({
  ...stamp(),
  name: "Fictional Test Resident",
  phone: "9000000000",
  email: "test@example.test",
  address: "",
  emergency: "",
  occupation: "",
  idMetadata: "",
  notes: "",
});
const stay = (bedId: string) => ({
  bedId,
  start: `${monthNow()}-01`,
  rent: 800000,
  deposit: 1000000,
  dueDay: 5,
  expectedCheckout: "",
});
beforeEach(async () => {
  store = new LocalStore(`test-${uid()}`);
  service = new ApplicationService(store);
  const s = emptySnapshot();
  s.settings = demoData().settings;
  await store.replace(s);
});
afterEach(async () => {
  await store.db.delete();
});
describe("transactional local workflows", () => {
  it("generates beds, safely expands, and preserves immutable IDs", async () => {
    const r = room();
    await service.saveRoom(r);
    const old = (await store.read()).beds.map((b) => b.id);
    expect(old).toHaveLength(3);
    await service.saveRoom({ ...r, capacity: 4 });
    const s = await store.read();
    expect(s.beds.filter((b) => !b.retired)).toHaveLength(4);
    expect(s.beds.map((b) => b.id)).toEqual(expect.arrayContaining(old));
  });
  it("blocks unsafe capacity reduction and leaves the whole transaction unchanged", async () => {
    const r = room();
    await service.saveRoom(r);
    const b = (await store.read()).beds.find((b) => b.position === 2)!,
      t = tenant();
    await service.checkIn(t, stay(b.id));
    await expect(service.saveRoom({ ...r, capacity: 2 })).rejects.toThrow(
      "is not free",
    );
    const s = await store.read();
    expect(s.rooms[0].capacity).toBe(3);
    expect(s.beds).toHaveLength(3);
    expect(bedStatus(s, b)).toBe("Occupied");
  });
  it("rejects simultaneous allocation of the same bed", async () => {
    await service.saveRoom(room());
    const b = (await store.read()).beds[0];
    const results = await Promise.allSettled([
      service.checkIn(tenant(), stay(b.id)),
      service.checkIn(tenant(), stay(b.id)),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await store.read()).occupancies).toHaveLength(1);
  });
  it("calculates partial and full payments exactly, rejects overpayments and duplicates", async () => {
    await service.saveRoom(room());
    const t = tenant();
    await service.checkIn(t, stay((await store.read()).beds[0].id));
    const i = (await store.read()).invoices[0],
      p = {
        ...stamp(),
        tenantId: t.id,
        amount: 500000,
        date: today(),
        method: "UPI" as const,
        reference: "test-ref",
        notes: "",
        key: uid(),
      };
    await service.payment(p, i.id);
    expect(balance(await store.read(), i)).toBe(300000);
    await expect(service.payment(p, i.id)).rejects.toThrow("already processed");
    await expect(
      service.payment(
        { ...p, ...stamp(), key: uid(), reference: "another", amount: 400000 },
        i.id,
      ),
    ).rejects.toThrow("more than the rent still due");
    await service.payment(
      { ...p, ...stamp(), key: uid(), reference: "complete", amount: 300000 },
      i.id,
    );
    expect(balance(await store.read(), i)).toBe(0);
  });
  it("checkout releases occupancy but retains finances and blocks cleaning beds", async () => {
    await service.saveRoom(room());
    const b = (await store.read()).beds[0],
      t = tenant();
    await service.checkIn(t, stay(b.id));
    await service.checkout(t.id, today(), true, "Test checkout");
    const s = await store.read();
    expect(bedStatus(s, b)).toBe("Cleaning");
    expect(s.invoices).toHaveLength(1);
    expect(s.occupancies[0].end).toBe(today());
    await expect(service.checkIn(tenant(), stay(b.id))).rejects.toThrow(
      "cleaning",
    );
  });
  it("transfers atomically and preserves previous stay history", async () => {
    await service.saveRoom(room());
    const beds = (await store.read()).beds,
      t = tenant();
    await service.checkIn(t, stay(beds[0].id));
    await service.transfer(t.id, beds[1].id, today(), false);
    const s = await store.read();
    expect(s.occupancies).toHaveLength(2);
    expect(bedStatus(s, beds[0])).toBe("Available");
    expect(bedStatus(s, beds[1])).toBe("Occupied");
  });
  it("keeps deposits and advances outside rent revenue and caps refunds", async () => {
    await service.saveRoom(room());
    const t = tenant();
    await service.checkIn(t, stay((await store.read()).beds[0].id));
    const o = (await store.read()).occupancies[0];
    await service.deposit({
      ...stamp(),
      tenantId: t.id,
      occupancyId: o.id,
      type: "Collected",
      amount: 100000,
      date: today(),
      notes: "",
    });
    await service.payment({
      ...stamp(),
      tenantId: t.id,
      amount: 200000,
      date: today(),
      method: "Cash",
      reference: "",
      notes: "",
      key: uid(),
    });
    expect(
      metrics(await store.read(), `${monthNow()}-01`, today()).collected,
    ).toBe(0);
    await expect(
      service.deposit({
        ...stamp(),
        tenantId: t.id,
        occupancyId: o.id,
        type: "Refund",
        amount: 100001,
        date: today(),
        notes: "",
      }),
    ).rejects.toThrow("more than the deposit you hold");
  });
  it("prevents double reservations and converts a reservation atomically", async () => {
    await service.saveRoom(room());
    const b = (await store.read()).beds[0],
      r = {
        ...stamp(),
        bedId: b.id,
        name: "Demo prospect",
        phone: "9000000000",
        checkIn: today(),
        expires: today(),
        amount: 0,
        status: "Confirmed" as const,
        notes: "",
      };
    await service.reservation(r);
    await expect(service.reservation({ ...r, ...stamp() })).rejects.toThrow(
      "reserved",
    );
    await service.checkIn(tenant(), stay(b.id), r.id);
    const s = await store.read();
    expect(s.reservations[0].status).toBe("Checked In");
    expect(bedStatus(s, b)).toBe("Occupied");
  });
  it("makes monthly generation idempotent and preserves prior invoice values", async () => {
    await service.saveRoom(room());
    await service.checkIn(tenant(), stay((await store.read()).beds[0].id));
    await service.generateInvoices(monthNow());
    await service.generateInvoices(monthNow());
    expect((await store.read()).invoices).toHaveLength(1);
  });
  it("round-trips backups and rejects orphans without replacing data", async () => {
    await store.replace(demoData());
    const backup = await service.export();
    expect(validateBackup(backup).rooms).toHaveLength(24);
    expect(backup.version).toBe(2);
    const olderBackup = JSON.parse(JSON.stringify(backup));
    olderBackup.version = 1;
    delete olderBackup.data.quotations;
    expect(validateBackup(olderBackup).quotations).toEqual([]);
    await service.import(JSON.parse(JSON.stringify(backup)));
    const invalid = structuredClone(backup);
    invalid.data.beds[0].roomId = "missing";
    await expect(service.import(invalid)).rejects.toThrow(
      "missing or conflicting records",
    );
    expect((await store.read()).beds[0].roomId).not.toBe("missing");
  });
  it("retired beds retain history and are not reused after expansion", async () => {
    const r = room();
    await service.saveRoom(r);
    const old = (await store.read()).beds.find((b) => b.position === 2)!;
    await service.saveRoom({ ...r, capacity: 2 });
    await service.saveRoom({ ...r, capacity: 3 });
    const s = await store.read();
    expect(s.beds.find((b) => b.id === old.id)?.retired).toBe(true);
    expect(s.beds.filter((b) => !b.retired)).toHaveLength(3);
    expect(s.beds.find((b) => !b.retired && b.position === 2)?.id).not.toBe(
      old.id,
    );
  });
  it("persists when a new repository opens the same database", async () => {
    await service.saveRoom(room());
    const reopened = new LocalStore(store.db.name);
    expect((await reopened.read()).rooms[0].number).toBe("TEST-101");
    reopened.db.close();
  });
});
