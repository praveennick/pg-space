import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ThemeToggle } from "../src/components/ThemeToggle";
import { NotificationsPopover } from "../src/components/NotificationsPopover";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("switches light/dark with one tap and persists the selection", () => {
  render(<ThemeToggle />);
  const toggle = screen.getByRole("button", { name: "Dark mode" });
  expect(toggle).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem("pg-theme")).toBe("dark");
  fireEvent.click(toggle);
  expect(document.documentElement.dataset.theme).toBe("light");
});
const notification = {
  id: "one",
  createdAt: "2026-10-25T10:00:00Z",
  title: "Rent received",
  message: "A payment was recorded.",
  href: "/app/payments",
  read: false,
};
const openPopover = () =>
  fireEvent.keyDown(screen.getByRole("button", { name: /Notifications/ }), {
    key: "Enter",
  });
it("opens notification previews, marks the selected update read and navigates", async () => {
  const markRead = vi.fn().mockResolvedValue(undefined),
    navigate = vi.fn();
  render(
    <NotificationsPopover
      notifications={[notification]}
      markRead={markRead}
      navigate={navigate}
    />,
  );
  openPopover();
  expect(
    await screen.findByRole("menu", { name: "Notifications" }),
  ).toBeVisible();
  expect(navigate).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("menuitem", { name: /Rent received/ }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/app/payments"));
  expect(markRead).toHaveBeenCalledWith("one");
});
it("shows an empty state and closes on Escape", async () => {
  render(
    <NotificationsPopover
      notifications={[]}
      markRead={vi.fn()}
      navigate={vi.fn()}
    />,
  );
  openPopover();
  expect(await screen.findByText("No notifications yet")).toBeVisible();
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  await waitFor(() =>
    expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
  );
});
it("keeps the popover open with a retry message if marking read fails", async () => {
  const markRead = vi.fn().mockRejectedValue(new Error("offline")),
    navigate = vi.fn();
  render(
    <NotificationsPopover
      notifications={[notification]}
      markRead={markRead}
      navigate={navigate}
    />,
  );
  openPopover();
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Mark all as read" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Please try again",
  );
  expect(markRead).toHaveBeenCalledWith(undefined);
  expect(navigate).not.toHaveBeenCalled();
});
