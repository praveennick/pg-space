import { expect, it, vi } from "vitest";
import { watchEmailAccess } from "../src/auth/members";
const mocks = vi.hoisted(() => ({ watch: vi.fn() }));
vi.mock("../src/data/firebase", () => ({ cloudDb: {}, cloudAuth: null }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: mocks.watch,
  query: vi.fn(),
  writeBatch: vi.fn(),
  where: vi.fn(),
}));
it("denies a fresh UID with the same verified email when its assignment is revoked", () => {
  const changed = vi.fn();
  watchEmailAccess("recreated-uid", "resident@example.com", changed, vi.fn());
  mocks.watch.mock.calls.at(-1)![1]({
    exists: () => true,
    data: () => ({
      email: "resident@example.com",
      ownerUid: "owner",
      role: "staff",
      tenantId: "",
      label: "Resident",
      workspaceName: "My PG",
      revoked: true,
    }),
  });
  expect(changed).toHaveBeenCalledWith(null);
});
