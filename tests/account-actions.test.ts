// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { handleAccountAction } from "../netlify/functions/_shared/account-actions";

type Data = Record<string, unknown>;
let data: Map<string, Data>;
const profile = "accounts/owner/portal/resident";
const stay = "accounts/owner/records/occupancies/items/stay";
const assignment = "emailAccess/resident@example.com";
const auth = {
  verifyIdToken: vi.fn(),
  getUserByEmail: vi.fn(),
  deleteUser: vi.fn(),
  revokeRefreshTokens: vi.fn(),
};
const ref = (path: string) => ({
  path,
  id: path.split("/").at(-1)!,
  get: async () => ({ exists: data.has(path), data: () => data.get(path) }),
  delete: async () => {
    data.delete(path);
  },
});
let sequence = 0;
const collection = (path: string, filters: Array<[string, unknown]> = []) => ({
  where: (
    key: string,
    _op: string,
    value: unknown,
  ): ReturnType<typeof collection> =>
    collection(path, [...filters, [key, value]]),
  doc: () => ref(`${path}/ticket-${++sequence}`),
  get: async () => {
    const docs = [...data]
      .filter(
        ([key, item]) =>
          key.startsWith(`${path}/`) &&
          filters.every(([field, value]) => item[field] === value),
      )
      .map(([key, item]) => ({
        id: ref(key).id,
        ref: ref(key),
        data: () => item,
      }));
    return { docs, empty: !docs.length };
  },
});
const db = {
  doc: ref,
  collection,
  runTransaction: async (work: (tx: object) => Promise<unknown>) => {
    const writes: Array<[string, Data, boolean]> = [];
    const deletions: string[] = [];
    const result = await work({
      get: (reference: { get: () => Promise<unknown> }) => reference.get(),
      delete: (reference: { path: string }) => deletions.push(reference.path),
      set: (
        reference: { path: string },
        value: Data,
        options?: { merge: boolean },
      ) => writes.push([reference.path, value, !!options?.merge]),
    });
    for (const [path, value, merge] of writes)
      data.set(path, merge ? { ...data.get(path), ...value } : value);
    deletions.forEach((path) => data.delete(path));
    return result;
  },
};
const invoke = (input: Data) =>
  handleAccountAction(
    new Request("https://pg.example.com/api/account-action", {
      method: "POST",
      headers: {
        Authorization: "Bearer token",
        Origin: "https://pg.example.com",
      },
      body: JSON.stringify({ ownerUid: "owner", ...input }),
    }),
    auth as unknown as Auth,
    db as unknown as Firestore,
    "https://pg.example.com",
  );
const asRole = (role: string) => {
  auth.verifyIdToken.mockResolvedValue({
    uid: role === "tenant" ? "resident-auth" : "team-auth",
    email: role === "tenant" ? "resident@example.com" : "team@example.com",
    email_verified: true,
  });
  data.set(role === "tenant" ? assignment : "emailAccess/team@example.com", {
    ownerUid: "owner",
    role,
    tenantId: role === "tenant" ? "resident" : "",
  });
};
beforeEach(() => {
  vi.resetAllMocks();
  sequence = 0;
  data = new Map([
    [assignment, { ownerUid: "owner", role: "tenant", tenantId: "resident" }],
    [profile, { name: "Resident", active: true }],
    [stay, { tenantId: "resident", bedId: "bed", end: null }],
    ["accounts/owner/records/beds/items/bed", { roomId: "room" }],
  ]);
  auth.verifyIdToken.mockResolvedValue({
    uid: "owner",
    email: "owner@example.com",
    email_verified: true,
  });
  auth.getUserByEmail.mockResolvedValue({ uid: "resident-auth" });
});
it("removes the Firebase login and PG assignment, keeping historical records", async () => {
  expect(
    (await invoke({ action: "remove", email: "resident@example.com" })).status,
  ).toBe(200);
  expect(auth.revokeRefreshTokens).toHaveBeenCalledWith("resident-auth");
  expect(auth.deleteUser).toHaveBeenCalledWith("resident-auth");
  expect(data.has(assignment)).toBe(false);
  expect(data.get(profile)?.active).toBe(false);
  expect(data.has(stay)).toBe(true);
});
it("blocks staff from deleting arbitrary users", async () => {
  asRole("staff");
  expect(
    (await invoke({ action: "remove", email: "resident@example.com" })).status,
  ).toBe(403);
  expect(auth.deleteUser).not.toHaveBeenCalled();
});
it("protects PG owner accounts", async () => {
  auth.getUserByEmail.mockResolvedValue({ uid: "other-owner" });
  data.set("accounts/other-owner/records/settings/items/property", {});
  expect(
    (await invoke({ action: "remove", email: "resident@example.com" })).status,
  ).toBe(409);
  expect(auth.deleteUser).not.toHaveBeenCalled();
});
it("allows staff checkout cleanup only after the stay ends", async () => {
  asRole("staff");
  expect(
    (await invoke({ action: "checkout", tenantId: "resident" })).status,
  ).toBe(409);
  expect(auth.deleteUser).not.toHaveBeenCalled();
  data.set(stay, { ...data.get(stay), end: "2026-10-25" });
  expect(
    (await invoke({ action: "checkout", tenantId: "resident" })).status,
  ).toBe(200);
  expect(auth.deleteUser).toHaveBeenCalledWith("resident-auth");
  expect(data.has(assignment)).toBe(false);
});
it("keeps tenant access blocked and cleanup retryable if Auth deletion fails", async () => {
  auth.deleteUser.mockRejectedValueOnce(new Error("network"));
  expect(
    (await invoke({ action: "remove", email: "resident@example.com" })).status,
  ).toBe(500);
  expect(data.get(profile)?.active).toBe(false);
  expect(data.has(assignment)).toBe(true);
  asRole("tenant");
  expect(await (await invoke({ action: "session" })).json()).toEqual({
    active: false,
  });
  auth.verifyIdToken.mockResolvedValue({
    uid: "owner",
    email: "owner@example.com",
  });
  expect(
    (await invoke({ action: "remove", email: "resident@example.com" })).status,
  ).toBe(200);
});
it("repairs legacy session metadata only for a current stay", async () => {
  asRole("tenant");
  data.set(profile, { name: "Resident" });
  expect(await (await invoke({ action: "session" })).json()).toEqual({
    active: true,
  });
  data.set(stay, { ...data.get(stay), end: "2026-10-25" });
  expect(await (await invoke({ action: "session" })).json()).toEqual({
    active: false,
  });
});
it("creates an own-bed Open ticket with server-controlled fields", async () => {
  asRole("tenant");
  expect(
    (
      await invoke({
        action: "ticket",
        category: "Electrical",
        description: "Fan is broken",
      })
    ).status,
  ).toBe(200);
  expect(
    data.get("accounts/owner/records/tickets/items/ticket-1"),
  ).toMatchObject({
    tenantId: "resident",
    occupancyId: "stay",
    roomId: "room",
    bedId: "bed",
    status: "Open",
    priority: "Medium",
    block: false,
    resolution: "",
  });
  expect(data.get("accounts/owner/control/version")?.number).toBe(1);
});
it("rejects attempts to choose another tenant or change status", async () => {
  asRole("tenant");
  expect(
    (
      await invoke({
        action: "ticket",
        category: "Other",
        description: "Broken fan",
        tenantId: "other",
        status: "Closed",
      })
    ).status,
  ).toBe(400);
});
it("blocks tickets after checkout and after revocation", async () => {
  asRole("tenant");
  data.set(profile, { active: false });
  expect(
    (
      await invoke({
        action: "ticket",
        category: "Other",
        description: "Broken fan",
      })
    ).status,
  ).toBe(403);
  data.set(profile, { active: true });
  data.set(stay, { ...data.get(stay), end: "2026-10-25" });
  expect(
    (
      await invoke({
        action: "ticket",
        category: "Other",
        description: "Broken fan",
      })
    ).status,
  ).toBe(403);
});
it("limits ticket submissions to five per resident per hour", async () => {
  asRole("tenant");
  for (let count = 0; count < 5; count++)
    expect(
      (
        await invoke({
          action: "ticket",
          category: "Other",
          description: "Broken fan",
        })
      ).status,
    ).toBe(200);
  expect(
    (
      await invoke({
        action: "ticket",
        category: "Other",
        description: "Broken fan",
      })
    ).status,
  ).toBe(429);
});
it("denies requests to another workspace", async () => {
  asRole("tenant");
  expect((await invoke({ action: "session", ownerUid: "other" })).status).toBe(
    403,
  );
  expect(auth.deleteUser).not.toHaveBeenCalled();
});
