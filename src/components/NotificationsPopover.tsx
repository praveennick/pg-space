import { useId, useState } from "react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Bell, CheckCheck } from "lucide-react";
import type { Entities } from "../domain/models";
import { displayDateTime } from "../domain/dates";
import "./NotificationsPopover.css";

export function NotificationsPopover({
  notifications,
  markRead,
  navigate,
}: {
  notifications: Entities["notifications"][];
  markRead: (id?: string) => Promise<void>;
  navigate: (href: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const unread = notifications.filter((item) => !item.read).length;
  const recent = [...notifications]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  const read = async (id?: string, href?: string) => {
    setBusy(true);
    setError("");
    try {
      await markRead(id);
      if (href) {
        setOpen(false);
        navigate(href);
      }
    } catch {
      setError("Could not mark updates as read. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dropdown.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError("");
      }}
    >
      <Dropdown.Trigger asChild>
        <button
          type="button"
          className="icon-button notification-button"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
          title="Notifications"
        >
          <Bell size={19} />
          {unread > 0 && <i />}
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          className="notification-popover"
          align="end"
          sideOffset={12}
          collisionPadding={12}
          aria-label="Notifications"
          aria-labelledby={headingId}
        >
          <div className="notification-popover-heading">
            <Dropdown.Label id={headingId}>Notifications</Dropdown.Label>
            <span>{unread} unread</span>
          </div>
          {unread > 0 && (
            <Dropdown.Item
              className="notification-mark-all"
              disabled={busy}
              onSelect={(event) => {
                event.preventDefault();
                void read();
              }}
            >
              <CheckCheck size={16} />
              {busy ? "Saving…" : "Mark all as read"}
            </Dropdown.Item>
          )}
          {error && (
            <p role="alert" className="notification-popover-error">
              {error}
            </p>
          )}
          <div className="notification-popover-list">
            {recent.length ? (
              recent.map((item) => (
                <Dropdown.Item
                  key={item.id}
                  className={`notification-preview ${item.read ? "" : "is-unread"}`}
                  disabled={busy}
                  onSelect={(event) => {
                    event.preventDefault();
                    if (item.read) {
                      setOpen(false);
                      navigate(item.href);
                    } else void read(item.id, item.href);
                  }}
                >
                  <span className="notification-preview-icon">
                    <Bell size={18} />
                  </span>
                  <span className="notification-preview-copy">
                    <strong>{item.title}</strong>
                    <span>{item.message}</span>
                    <small>{displayDateTime(item.createdAt)}</small>
                  </span>
                  {!item.read && (
                    <span
                      className="notification-unread-dot"
                      aria-label="Unread"
                    />
                  )}
                </Dropdown.Item>
              ))
            ) : (
              <div className="notification-popover-empty">
                <Bell size={28} />
                <strong>No notifications yet</strong>
                <p>Your PG updates will appear here.</p>
              </div>
            )}
          </div>
          <Dropdown.Item
            className="notification-view-all"
            onSelect={() => navigate("/app/notifications")}
          >
            See all updates
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
