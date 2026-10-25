// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { handleAccountEmail } from "../netlify/functions/_shared/account-email";

type Data = Record<string, unknown>;
let data: Map<string, Data>;
const auth = { getUserByEmail: vi.fn(), createUser: vi.fn() };
const fetcher = vi.fn();
const ref = (path: string) => ({
  path,
  get: async () => ({ exists: data.has(path), data: () => data.get(path) }),
});
const collection = (path: string, filters: Array<[string, unknown]> = []) => ({
  where: (
    key: string,
    _op: string,
    value: unknown,
  ): ReturnType<typeof collection> =>
    collection(path, [...filters, [key, value]]),
  get: async () => ({
    empty: ![...data].some(
      ([key, value]) =>
        key.startsWith(`${path}/`) &&
        filters.every(([field, expected]) => value[field] === expected),
    ),
  }),
});
const db = {
  doc: ref,
  collection,
  runTransaction: async (work: (tx: object) => Promise<unknown>) => {
    const writes: Array<[string, Data]> = [];
    const result = await work({
      get: (reference: { get: () => Promise<unknown> }) => reference.get(),
      set: (reference: { path: string }, value: Data) =>
        writes.push([reference.path, value]),
    });
    writes.forEach(([path, value]) => data.set(path, value));
    return result;
  },
};
const invoke = (mode = "setup", extra: Data = {}) =>
  handleAccountEmail(
    new Request("https://pg.example.com/api/account-email", {
      method: "POST",
      headers: { Origin: "https://pg.example.com" },
      body: JSON.stringify({ email: "resident@example.com", mode, ...extra }),
    }),
    {
      auth: auth as unknown as Auth,
      db: db as unknown as Firestore,
      apiKey: "test-key",
      appUrl: "https://pg.example.com",
      ip: "192.0.2.1",
      fetcher,
    },
  );
const grant = "emailAccess/resident@example.com";
beforeEach(() => {
  vi.resetAllMocks();
  data = new Map();
  auth.getUserByEmail.mockRejectedValue({ code: "auth/user-not-found" });
  auth.createUser.mockResolvedValue({ uid: "resident-auth" });
  fetcher.mockResolvedValue(Response.json({ email: "resident@example.com" }));
});
it("does not create or reset an account without an invitation", async () => {
  const response = await invoke();
  expect(response.status).toBe(200);
  expect((await response.json()).message).toContain(
    "If this email has active PG access",
  );
  expect(auth.createUser).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});
it.each(["setup", "reset"])(
  "blocks removed users from %s even if their Firebase login remains",
  async (mode) => {
    data.set(grant, {
      ownerUid: "owner",
      role: "staff",
      tenantId: "",
      revoked: true,
    });
    auth.getUserByEmail.mockResolvedValue({ uid: "resident-auth" });
    expect((await invoke(mode)).status).toBe(200);
    expect(fetcher).not.toHaveBeenCalled();
    expect(auth.createUser).not.toHaveBeenCalled();
  },
);
it("provisions an invited staff email without a browser-supplied password", async () => {
  data.set(grant, { ownerUid: "owner", role: "staff", tenantId: "" });
  expect((await invoke()).status).toBe(200);
  expect(auth.createUser).toHaveBeenCalledWith({
    email: "resident@example.com",
    emailVerified: false,
  });
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
    requestType: "PASSWORD_RESET",
    email: "resident@example.com",
    continueUrl: "https://pg.example.com/app",
  });
});
it("does not create accounts during Forgot password", async () => {
  data.set(grant, { ownerUid: "owner", role: "staff", tenantId: "" });
  await invoke("reset");
  expect(auth.createUser).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});
it("rejects passwords and role overrides in public requests", async () => {
  expect(
    (await invoke("setup", { password: "Secret123", role: "super_admin" }))
      .status,
  ).toBe(400);
  expect(auth.createUser).not.toHaveBeenCalled();
});
it("blocks checked-out tenants whose old grants remain", async () => {
  data.set(grant, { ownerUid: "owner", role: "tenant", tenantId: "resident" });
  auth.getUserByEmail.mockResolvedValue({ uid: "resident-auth" });
  await invoke("reset");
  expect(fetcher).not.toHaveBeenCalled();
});
it("lets an existing original owner recover their password", async () => {
  auth.getUserByEmail.mockResolvedValue({ uid: "owner" });
  data.set("accounts/owner/records/settings/items/property", { name: "My PG" });
  await invoke("reset");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("enforces a server-side limit even for unknown email addresses", async () => {
  for (let count = 0; count < 3; count++)
    expect((await invoke()).status).toBe(200);
  expect((await invoke()).status).toBe(429);
  expect(fetcher).not.toHaveBeenCalled();
});
