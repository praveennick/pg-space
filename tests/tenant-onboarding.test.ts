// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { handleTenantOnboarding } from "../netlify/functions/_shared/tenant-onboarding";

type Data = Record<string, unknown>;
const tenantPath = "accounts/owner/records/tenants/items/resident-one";
const statePath = "accounts/owner/tenantOnboarding/resident-one";
let documents: Map<string, Data>;
const actor = {
  uid: "owner",
  email: "owner@example.com",
  email_verified: true,
};
const auth = {
  verifyIdToken: vi.fn(),
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
};
const fetcher = vi.fn();
const snapshot = (path: string) => ({
  exists: documents.has(path),
  data: () => documents.get(path),
});
const reference = (path: string) => ({
  path,
  get: async () => snapshot(path),
  set: async (data: Data, options?: { merge: boolean }) =>
    documents.set(
      path,
      options?.merge ? { ...documents.get(path), ...data } : data,
    ),
});
const collection = (
  path: string,
  filters: Array<[string, unknown]> = [],
): unknown => ({
  where: (field: string, _operator: string, value: unknown) =>
    collection(path, [...filters, [field, value]]),
  get: async () => ({
    docs: [...documents.entries()]
      .filter(
        ([key, data]) =>
          key.startsWith(`${path}/`) &&
          filters.every(([field, value]) => data[field] === value),
      )
      .map(([key, value]) => ({
        ref: reference(key),
        id: key.split("/").at(-1),
        data: () => value,
      })),
  }),
});
const db = {
  doc: reference,
  collection,
  runTransaction: async (work: (transaction: object) => Promise<unknown>) => {
    const writes: Array<[string, Data]> = [];
    const result = await work({
      get: async (ref: { path: string }) => snapshot(ref.path),
      set: (ref: { path: string }, data: Data) => writes.push([ref.path, data]),
    });
    writes.forEach(([path, value]) => documents.set(path, value));
    return result;
  },
};
const request = (extra: Data = {}) =>
  new Request("https://pg.example.com/api/tenant-login", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-token",
      Origin: "https://pg.example.com",
    },
    body: JSON.stringify({
      ownerUid: "owner",
      tenantId: "resident-one",
      ...extra,
    }),
  });
const invoke = (input = request()) =>
  handleTenantOnboarding(input, {
    auth: auth as unknown as Auth,
    db: db as unknown as Firestore,
    apiKey: "public-test-key",
    appUrl: "https://pg.example.com",
    fetcher,
    now: () => 1_700_000_000_000,
  });
beforeEach(() => {
  vi.clearAllMocks();
  documents = new Map([
    [
      tenantPath,
      {
        id: "resident-one",
        name: "Test Resident",
        email: " Resident@Example.com ",
        phone: "9000000000",
        occupation: "Student",
      },
    ],
    ["accounts/owner/records/settings/items/property", { name: "Lucky PG" }],
    [
      "accounts/owner/records/occupancies/items/stay-one",
      { id: "stay-one", tenantId: "resident-one", end: null },
    ],
  ]);
  auth.verifyIdToken.mockResolvedValue(actor);
  auth.getUserByEmail.mockRejectedValue({ code: "auth/user-not-found" });
  auth.createUser.mockResolvedValue({ uid: "new-resident" });
  fetcher.mockImplementation(async () =>
    Response.json({ email: "resident@example.com" }),
  );
});

describe("automatic tenant login setup", () => {
  it("does not recreate revoked tenant access by resending a login email", async () => {
    documents.set("emailAccess/resident@example.com", {
      ownerUid: "owner",
      role: "tenant",
      tenantId: "resident-one",
      revoked: true,
    });
    expect((await invoke(request({ resend: true }))).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
    expect(auth.createUser).not.toHaveBeenCalled();
  });
  it("does not recreate login access for a checked-out resident", async () => {
    documents.delete("accounts/owner/records/occupancies/items/stay-one");
    expect((await invoke()).status).toBe(409);
    expect(auth.createUser).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("creates exactly the saved email, assigns only tenant access, and requests a Firebase password link", async () => {
    const response = await invoke();
    expect(response.status).toBe(200);
    expect(auth.createUser).toHaveBeenCalledWith({
      email: "resident@example.com",
      displayName: "Test Resident",
      emailVerified: false,
    });
    expect(documents.get("emailAccess/resident@example.com")).toMatchObject({
      role: "tenant",
      ownerUid: "owner",
      tenantId: "resident-one",
    });
    const payload = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(payload).toEqual({
      requestType: "PASSWORD_RESET",
      email: "resident@example.com",
      continueUrl: "https://pg.example.com/app",
    });
    expect(documents.get(statePath)?.status).toBe("submitted");
  });
  it("rejects a browser-supplied recipient override", async () => {
    const response = await invoke(
      request({ email: "someoneelse@example.com" }),
    );
    expect(response.status).toBe(400);
    expect(auth.createUser).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects staff accounts before changing any access", async () => {
    auth.verifyIdToken.mockResolvedValue({
      ...actor,
      uid: "staff",
      email: "staff@example.com",
    });
    documents.set("emailAccess/staff@example.com", {
      ownerUid: "owner",
      role: "staff",
    });
    expect((await invoke()).status).toBe(403);
    expect(auth.createUser).not.toHaveBeenCalled();
  });
  it("allows a verified admin to provision a tenant without granting general team management", async () => {
    auth.verifyIdToken.mockResolvedValue({
      ...actor,
      uid: "admin",
      email: "admin@example.com",
    });
    documents.set("emailAccess/admin@example.com", {
      ownerUid: "owner",
      role: "admin",
    });
    expect((await invoke()).status).toBe(200);
    expect(documents.get("emailAccess/resident@example.com")?.role).toBe(
      "tenant",
    );
  });
  it("does not downgrade an existing admin or transfer another resident's login", async () => {
    const grant = { ownerUid: "owner", role: "admin", tenantId: "" };
    documents.set("emailAccess/resident@example.com", grant);
    expect((await invoke()).status).toBe(409);
    expect(documents.get("emailAccess/resident@example.com")).toEqual(grant);
    expect(auth.createUser).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not create a second login when the resident is already linked to another email", async () => {
    documents.set("emailAccess/old@example.com", {
      ownerUid: "owner",
      role: "tenant",
      tenantId: "resident-one",
    });
    expect((await invoke()).status).toBe(409);
    expect(auth.createUser).not.toHaveBeenCalled();
  });
  it("reuses an existing account without changing its password", async () => {
    auth.getUserByEmail.mockResolvedValue({
      uid: "existing-resident",
      disabled: false,
    });
    expect((await invoke()).status).toBe(200);
    expect(auth.createUser).not.toHaveBeenCalled();
    expect(documents.get(statePath)?.authUid).toBe("existing-resident");
  });
  it("does not duplicate the automatic email request on repeated saves", async () => {
    expect((await invoke()).status).toBe(200);
    const again = await invoke();
    expect(await again.json()).toMatchObject({ status: "already_submitted" });
    expect(auth.createUser).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("keeps the resident saved and records failure when Firebase rejects the email", async () => {
    fetcher.mockResolvedValue(Response.json({ error: {} }, { status: 400 }));
    expect((await invoke()).status).toBe(502);
    expect(documents.has(tenantPath)).toBe(true);
    expect(documents.get(statePath)?.status).toBe("failed");
  });
  it("returns and records a safe actionable Firebase error code", async () => {
    fetcher.mockResolvedValue(
      Response.json(
        { error: { message: "UNAUTHORIZED_DOMAIN" } },
        { status: 400 },
      ),
    );
    const response = await invoke();
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "UNAUTHORIZED_DOMAIN",
    });
    expect(documents.get(statePath)?.errorCode).toBe("UNAUTHORIZED_DOMAIN");
    expect(documents.has(tenantPath)).toBe(true);
  });
  it("does not automatically repeat an email whose submission is uncertain", async () => {
    fetcher.mockRejectedValue(new Error("timeout"));
    expect((await invoke()).status).toBe(500);
    expect(documents.get(statePath)?.status).toBe("uncertain");
    expect((await invoke()).status).toBe(409);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("limits repeated explicit invitations", async () => {
    for (let attempt = 0; attempt < 3; attempt++)
      expect((await invoke(request({ resend: true }))).status).toBe(200);
    expect((await invoke(request({ resend: true }))).status).toBe(429);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("credits definite configuration failures but retains the PG-wide limit", async () => {
    fetcher.mockImplementation(async () =>
      Response.json(
        { error: { message: "UNAUTHORIZED_DOMAIN" } },
        { status: 400 },
      ),
    );
    for (let attempt = 0; attempt < 30; attempt++) {
      expect((await invoke(request({ resend: true }))).status).toBe(400);
      expect(documents.get(statePath)?.attempts).toBe(0);
    }
    expect((await invoke(request({ resend: true }))).status).toBe(429);
    expect(fetcher).toHaveBeenCalledTimes(30);
  });
  it("does not credit provider quota rejections or uncertain submissions", async () => {
    fetcher.mockImplementation(async () =>
      Response.json(
        { error: { message: "TOO_MANY_ATTEMPTS_TRY_LATER" } },
        { status: 429 },
      ),
    );
    expect((await invoke()).status).toBe(429);
    expect(documents.get(statePath)?.attempts).toBe(1);
    fetcher.mockRejectedValue(new Error("timeout"));
    expect((await invoke(request({ resend: true }))).status).toBe(500);
    expect(documents.get(statePath)?.attempts).toBe(2);
  });
  it("does not overwrite or credit a newer invitation after a late failure", async () => {
    fetcher.mockImplementation(async () => {
      documents.set(statePath, {
        attemptId: "newer",
        status: "submitted",
        attempts: 3,
      });
      return Response.json(
        { error: { message: "UNAUTHORIZED_DOMAIN" } },
        { status: 400 },
      );
    });
    expect((await invoke()).status).toBe(400);
    expect(documents.get(statePath)).toEqual({
      attemptId: "newer",
      status: "submitted",
      attempts: 3,
    });
  });
  it("does not automatically retry a stale processing request", async () => {
    documents.set(statePath, {
      status: "processing",
      email: "resident@example.com",
      startedAt: 1,
    });
    expect((await invoke()).status).toBe(409);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not convert a PG owner into a tenant", async () => {
    auth.getUserByEmail.mockResolvedValue({ uid: "another-owner" });
    documents.set("accounts/another-owner/records/settings/items/property", {
      name: "Another PG",
    });
    expect((await invoke()).status).toBe(409);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects expired authentication", async () => {
    auth.verifyIdToken.mockRejectedValue(new Error("expired"));
    expect((await invoke()).status).toBe(401);
    expect(auth.createUser).not.toHaveBeenCalled();
  });
});
