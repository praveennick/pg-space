import Dexie, { liveQuery } from "dexie";
import {
  names,
  emptySnapshot,
  type EntityName,
  type Entities,
  type Snapshot,
} from "../domain/models";
import type { DataStore, Repository } from "./contracts";
export class LocalStore implements DataStore {
  db: Dexie;
  repositories: DataStore["repositories"];
  constructor(name = "pg-space-v1") {
    this.db = new Dexie(name);
    this.db.version(1).stores({
      rooms: "id,&number,floor",
      beds: "id,roomId",
      tenants: "id,name",
      occupancies: "id,tenantId,bedId",
      reservations: "id,bedId",
      invoices: "id,&[occupancyId+month],tenantId",
      payments: "id,&key,tenantId",
      allocations: "id,paymentId,invoiceId",
      deposits: "id,tenantId",
      expenses: "id,date,category",
      tickets: "id,roomId,bedId",
      notifications: "id",
      audit: "id,createdAt",
      settings: "id",
    });
    this.db.version(2).stores({ quotations: "id,&number,date,updatedAt" });
    this.db.version(3).stores({ tenantPhotos: "tenantId" });
    const repo = <K extends EntityName>(name: K): Repository<K> => ({
      getAll: () => this.db.table<Entities[K]>(name).toArray(),
      getById: (id) => this.db.table<Entities[K]>(name).get(id),
      put: async (value) => {
        await this.db.table(name).put(value);
      },
    });
    this.repositories = Object.fromEntries(
      names.map((n) => [n, repo(n)]),
    ) as DataStore["repositories"];
  }
  async read(): Promise<Snapshot> {
    const s = emptySnapshot();
    await Promise.all(
      names.map(async (n) => {
        (s[n] as unknown[]) = await this.repositories[n].getAll();
      }),
    );
    s.beds.sort(
      (a, b) => a.roomId.localeCompare(b.roomId) || a.position - b.position,
    );
    s.audit.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    s.notifications.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    s.occupancies.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return s;
  }
  async transact<T>(work: (state: Snapshot) => T): Promise<T> {
    return this.db.transaction("rw", this.db.tables, async () => {
      const s = await this.read();
      const result = work(s);
      for (const n of names) await this.db.table(n).bulkPut(s[n]);
      return result;
    });
  }
  async replace(s: Snapshot) {
    await this.db.transaction("rw", this.db.tables, async () => {
      await this.db.table("tenantPhotos").clear();
      for (const n of names) {
        await this.db.table(n).clear();
        await this.db.table(n).bulkPut(s[n]);
      }
    });
  }
  subscribe(listener: () => void) {
    const sub = liveQuery(() => this.read()).subscribe(() => listener());
    return () => sub.unsubscribe();
  }
}
