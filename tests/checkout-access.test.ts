import { beforeEach, expect, it, vi } from "vitest";
import { FirestoreStore } from "../src/data/firestore";
import { ApplicationService } from "../src/services/application";
import { balance } from "../src/domain/calculations";
import { today } from "../src/domain/models";

const mock = vi.hoisted(() => ({
  data: new Map<string, Record<string, unknown>>(),
  commit: vi.fn(),
}));
vi.mock("../src/data/firebase", () => ({ cloudDb: {} }));
vi.mock("firebase/firestore", () => {
  const path = (...args: unknown[]) =>
    args.filter((arg) => typeof arg === "string").join("/");
  const snapshot = (key: string) => ({
    id: key.split("/").at(-1),
    exists: () => mock.data.has(key),
    data: () => structuredClone(mock.data.get(key)),
  });
  return {
    doc: path,
    collection: path,
    onSnapshot: vi.fn(),
    getDoc: async (key: string) => snapshot(key),
    getDocs: async (prefix: string) => ({
      docs: [...mock.data.keys()]
        .filter((key) => key.startsWith(`${prefix}/`))
        .map(snapshot),
    }),
    runTransaction: async (
      _db: unknown,
      work: (tx: object) => Promise<void>,
    ) => {
      const writes: Array<[string, Record<string, unknown> | undefined]> = [];
      await work({
        get: async (key: string) => snapshot(key),
        set: (key: string, data: Record<string, unknown>) =>
          writes.push([key, data]),
        delete: (key: string) => writes.push([key, undefined]),
      });
      mock.commit(writes);
      for (const [key, data] of writes) {
        if (data) mock.data.set(key, data);
        else mock.data.delete(key);
      }
    },
  };
});
const stayPath = "accounts/owner/records/occupancies/items/stay";
const profilePath = "accounts/owner/portal/resident";
beforeEach(() => {
  mock.commit.mockReset();
  mock.data = new Map([
    [
      "accounts/owner/records/tenants/items/resident",
      {
        id: "resident",
        name: "Resident",
        phone: "12345",
        email: "resident@example.com",
        occupation: "",
      },
    ],
    [
      stayPath,
      {
        id: "stay",
        tenantId: "resident",
        bedId: "bed",
        start: "2026-10-01",
        end: null,
      },
    ],
    [profilePath, { name: "Resident", active: true }],
  ]);
});
it("ends the stay and blocks portal access in one commit", async () => {
  const store = new FirestoreStore();
  store.setSession("owner", "super_admin");
  await store.transact((state) => {
    state.occupancies[0].end = "2026-10-25";
  });
  expect(mock.commit).toHaveBeenCalledTimes(1);
  expect(mock.data.get(stayPath)?.end).toBe("2026-10-25");
  expect(mock.data.get(profilePath)?.active).toBe(false);
  await store.transact((state) => {
    state.tenants[0].phone = "67890";
  });
  expect(mock.data.get(profilePath)?.active).toBe(false);
});
it("does not end the stay if the access-blocking commit fails", async () => {
  const store = new FirestoreStore();
  store.setSession("owner", "staff");
  mock.commit.mockImplementation(() => {
    throw new Error("Permission denied");
  });
  await expect(
    store.transact((state) => {
      state.occupancies[0].end = "2026-10-25";
    }),
  ).rejects.toThrow("Permission denied");
  expect(mock.data.get(stayPath)?.end).toBeNull();
  expect(mock.data.get(profilePath)?.active).toBe(true);
});

it("loads rent data for staff and saves collected rent with its allocation", async () => {
  const store = new FirestoreStore();
  store.setSession("owner", "staff");
  const invoicePath = "accounts/owner/records/invoices/items/invoice";
  const invoice = {
    id: "invoice",
    tenantId: "resident",
    occupancyId: "stay",
    month: today().slice(0, 7),
    due: today(),
    amount: 850000,
    description: "Monthly rent",
    createdAt: new Date().toISOString(),
  };
  mock.data.set(invoicePath, invoice);
  await new ApplicationService(store).payment(
    {
      id: "payment",
      createdAt: new Date().toISOString(),
      tenantId: "resident",
      amount: 850000,
      date: today(),
      method: "Cash",
      reference: "",
      notes: "Collected by staff",
      key: "payment-request",
    },
    "invoice",
  );
  const state = await store.read();
  expect(state.payments).toHaveLength(1);
  expect(state.allocations).toHaveLength(1);
  expect(balance(state, state.invoices[0])).toBe(0);
  expect(mock.data.get(invoicePath)).toEqual(invoice);
});
