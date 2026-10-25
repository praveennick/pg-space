import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AccessContext } from "../src/auth/access";
import TenantPortal from "../src/pages/TenantPortal";

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  getDocs: vi.fn(),
  snapshot: vi.fn(),
  getDoc: vi.fn(),
}));
vi.mock("../src/data/firebase", () => ({ cloudDb: {}, cloudAuth: {} }));
vi.mock("../src/services/accountActions", () => ({
  accountAction: mocks.action,
}));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...path: string[]) => path.join("/"),
  doc: (_db: unknown, ...path: string[]) => path.join("/"),
  query: (path: string) => path,
  where: vi.fn(),
  getDoc: mocks.getDoc,
  getDocs: mocks.getDocs,
  onSnapshot: mocks.snapshot,
}));
const renderPortal = () =>
  render(
    <AccessContext.Provider
      value={{
        uid: "resident-auth",
        ownerUid: "owner",
        role: "tenant",
        tenantId: "resident",
      }}
    >
      <TenantPortal />
    </AccessContext.Provider>,
  );
beforeEach(() => {
  vi.clearAllMocks();
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  mocks.action.mockResolvedValue({ active: true });
  mocks.getDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({
      name: "Test Resident",
      phone: "12345",
      email: "resident@example.com",
    }),
  });
  mocks.getDocs.mockImplementation(async (path: string) => ({
    docs: path.includes("occupancies")
      ? [
          {
            data: () => ({
              id: "stay",
              start: "2026-10-01",
              end: null,
              rent: 850000,
            }),
          },
        ]
      : [],
  }));
  mocks.snapshot.mockReturnValue(() => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("submits a request without client-selected identity or status and saves the theme", async () => {
  renderPortal();
  expect(
    await screen.findByRole("heading", { name: "Repairs & help" }),
  ).toBeVisible();
  fireEvent.change(screen.getByLabelText("Colour theme"), {
    target: { value: "dark" },
  });
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("pg-theme")).toBe("dark");
  fireEvent.change(screen.getByLabelText("Describe the problem"), {
    target: { value: "Fan is not working" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send repair request" }));
  await waitFor(() =>
    expect(mocks.action).toHaveBeenCalledWith({
      action: "ticket",
      ownerUid: "owner",
      category: "Other",
      description: "Fan is not working",
    }),
  );
  expect(
    screen.queryByRole("button", { name: /edit|resolve|close request/i }),
  ).not.toBeInTheDocument();
});
it("hides records and request submission for a checked-out tenant", async () => {
  mocks.action.mockResolvedValue({ active: false });
  renderPortal();
  expect(await screen.findByText("Your PG access has ended")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Send repair request" }),
  ).not.toBeInTheDocument();
  expect(mocks.getDocs).not.toHaveBeenCalled();
});
