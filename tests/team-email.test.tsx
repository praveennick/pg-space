import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AccessContext } from "../src/auth/access";
import Team from "../src/pages/Team";

const api = vi.hoisted(() => ({
  list: vi.fn().mockResolvedValue([]),
  save: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn(),
}));
vi.mock("../src/data/firebase", () => ({
  firebaseMode: true,
  cloudAuth: { currentUser: { email: "original@example.com" } },
}));
vi.mock("../src/auth/members", () => ({
  listMembers: api.list,
  saveMember: api.save,
  removeMember: api.remove,
  accessErrorMessage: (error: Error) => error.message,
}));
vi.mock("../src/hooks/useApp", () => ({
  useApp: () => ({ s: { settings: [{ name: "Lucky PG" }], tenants: [] } }),
}));
afterEach(cleanup);

it("adds a super admin using just email and role without technical account fields", async () => {
  render(
    <AccessContext.Provider
      value={{ uid: "owner", ownerUid: "owner", role: "super_admin" }}
    >
      <Team />
    </AccessContext.Provider>,
  );
  await screen.findByText("No one else has access yet.");
  expect(screen.queryByLabelText("Firebase user UID")).toBeNull();
  expect(screen.queryByText("Workspace code")).toBeNull();
  expect(screen.getByRole("heading", { name: "Staff access" })).toBeVisible();
  expect(screen.getByText(/Cannot add or check in residents/)).toBeVisible();
  fireEvent.change(screen.getByLabelText("Access level"), {
    target: { value: "admin" },
  });
  expect(screen.getByRole("heading", { name: "Admin access" })).toBeVisible();
  expect(screen.getByText(/Cannot add or remove users/)).toBeVisible();
  fireEvent.change(screen.getByLabelText("Access level"), {
    target: { value: "tenant" },
  });
  expect(screen.getByText(/View only their own basic profile/)).toBeVisible();
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "newowner@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Access level"), {
    target: { value: "super_admin" },
  });
  expect(
    screen.getByRole("heading", { name: "Super admin access" }),
  ).toBeVisible();
  expect(screen.getByText(/Full access to this PG only/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Save access" }));
  await waitFor(() =>
    expect(api.save).toHaveBeenCalledWith(
      "owner",
      "Lucky PG",
      {
        email: "newowner@example.com",
        label: "",
        role: "super_admin",
        tenantId: "",
      },
      undefined,
    ),
  );
});
