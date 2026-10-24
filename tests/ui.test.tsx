import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Modal, Button } from "../src/components/ui";
it("provides an accessible modal with a keyboard-operable close action", () => {
  const close = vi.fn();
  render(
    <Modal
      title="Confirm archive"
      description="Historical records remain."
      onClose={close}
    >
      <Button>Confirm</Button>
    </Modal>,
  );
  expect(screen.getByRole("dialog", { name: "Confirm archive" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  expect(close).toHaveBeenCalledOnce();
});
