import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AccessContext, type Role } from "../src/auth/access";
import { emptySnapshot } from "../src/domain/models";
import Finance from "../src/pages/Finance";

const mocked = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("../src/hooks/useApp", () => ({
  useApp: () => ({ s: emptySnapshot(), open: mocked.open }),
}));
vi.mock("../src/services/export", () => ({
  downloadReceiptBlob: vi.fn(),
  exportCsv: vi.fn(),
  receipt: vi.fn(),
  receiptPdf: vi.fn(),
}));
vi.mock("../src/components/WhatsAppReminder", () => ({
  WhatsAppReminder: () => null,
}));
const show = (role: Role) =>
  render(
    <AccessContext.Provider value={{ uid: "user", ownerUid: "owner", role }}>
      <MemoryRouter initialEntries={["/app/payments"]}>
        <Finance />
      </MemoryRouter>
    </AccessContext.Provider>,
  );
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("lets staff collect rent while hiding bill creation and deposits", () => {
  show("staff");
  fireEvent.click(screen.getByRole("button", { name: "Record payment" }));
  expect(mocked.open).toHaveBeenCalledWith({ kind: "payment" });
  expect(
    screen.queryByRole("button", { name: "Create rent bills" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Deposits" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Deposits held")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Payments received" }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Advance money" })).toBeVisible();
});
it("keeps bill creation and deposits available to admins", () => {
  show("admin");
  expect(
    screen.getByRole("button", { name: "Create rent bills" }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Deposits" })).toBeVisible();
});
