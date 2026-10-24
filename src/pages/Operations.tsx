import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  Plus,
  CheckCheck,
  Bell,
  Clock3,
  CalendarDays,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../hooks/useApp";
import { displayDate, displayDateTime } from "../domain/dates";
import { service } from "../data";
import { activeReservation, balance } from "../domain/calculations";
import { today, rupees } from "../domain/models";
import { Button, Badge, Empty, Modal, Field } from "../components/ui";
const plainActivity = (value: string) =>
  value
    .replaceAll("Monthly billing generated", "Rent bills created")
    .replaceAll("Advance allocated", "Advance used for rent")
    .replaceAll("Maintenance ticket opened", "Repair request added")
    .replaceAll("Maintenance updated", "Repair request updated")
    .replaceAll("Room archived", "Room hidden")
    .replaceAll("deposit ledger", "deposit history")
    .replaceAll(
      "Existing invoices are preserved; review billing before generating a transfer-month invoice.",
      "Old rent bills stay the same. Check the rent for the month of this bed change.",
    );
export default function Operations() {
  const { s, open } = useApp(),
    page = useLocation().pathname.split("/").at(-1),
    [filter, setFilter] = useState("All"),
    [resolve, setResolve] = useState(""),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false),
    [cancel, setCancel] = useState("");
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      toast.success("Updated");
      setResolve("");
      setCancel("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const isRes = page === "reservations",
    isMaint = page === "maintenance",
    isNot = page === "notifications",
    title = isRes
      ? "Reservations"
      : isMaint
        ? "Repairs"
        : isNot
          ? "Updates"
          : "Changes made";
  const alerts = [
    ...s.invoices
      .filter((i) => i.due < today() && balance(s, i) > 0)
      .map((i) => ({
        id: i.id,
        title: "Overdue rent",
        text: `${s.tenants.find((t) => t.id === i.tenantId)?.name} · ${rupees(balance(s, i))} due`,
        href: "/app/payments?status=Outstanding",
      })),
    ...s.reservations
      .filter((r) => activeReservation(r) && r.expires <= today())
      .map((r) => ({
        id: r.id,
        title: "Reservation expires today",
        text: r.name,
        href: "/app/reservations",
      })),
    ...s.occupancies
      .filter(
        (o) => !o.end && o.expectedCheckout && o.expectedCheckout >= today(),
      )
      .map((o) => ({
        id: o.id,
        title: "Upcoming checkout",
        text: `${s.tenants.find((t) => t.id === o.tenantId)?.name} · ${o.expectedCheckout}`,
        href: `/app/tenants/${o.tenantId}`,
      })),
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PG UPDATES</div>
          <h1>{title}</h1>
          <p>
            {isRes
              ? "See who has booked a bed and when they will move in."
              : isMaint
                ? "Track repairs and cleaning work."
                : isNot
                  ? "See messages about your PG."
                  : "See what was changed and when."}
          </p>
        </div>
        {(isRes || isMaint) && (
          <Button
            onClick={() => open({ kind: isRes ? "reservation" : "ticket" })}
          >
            <Plus size={17} />
            {isRes ? "New reservation" : "Report a problem"}
          </Button>
        )}
        {isNot && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => run(() => service.markRead())}
          >
            <CheckCheck size={16} /> Mark all read
          </Button>
        )}
      </div>
      {(isRes || isMaint) && (
        <div
          className="tabs standalone operation-tabs"
          aria-label={`${title} filters`}
        >
          {(isRes
            ? [
                "All",
                "Pending",
                "Confirmed",
                "Checked In",
                "Cancelled",
                "Expired",
              ]
            : ["All", "Open", "In Progress", "Resolved", "Closed"]
          ).map((v) => (
            <button
              key={v}
              className={filter === v ? "active" : ""}
              aria-pressed={filter === v}
              onClick={() => setFilter(v)}
            >
              {v}
            </button>
          ))}
        </div>
      )}
      {isRes && (
        <div className="operation-grid">
          {s.reservations
            .filter(
              (r) =>
                filter === "All" ||
                ((r.status === "Pending" || r.status === "Confirmed") &&
                  r.expires < today() &&
                  filter === "Expired") ||
                (r.status === filter &&
                  !(
                    r.expires < today() &&
                    ["Pending", "Confirmed"].includes(r.status)
                  )),
            )
            .map((r) => (
              <section className="panel operation-card" key={r.id}>
                <div className="operation-top">
                  <span className="metric-icon purple">
                    <CalendarDays size={21} />
                  </span>
                  <Badge status={activeReservation(r) ? "Reserved" : r.status}>
                    {["Pending", "Confirmed"].includes(r.status) &&
                    r.expires < today()
                      ? "Expired"
                      : r.status}
                  </Badge>
                </div>
                <h3>{r.name}</h3>
                <p>{r.phone}</p>
                <div className="report-row">
                  <span>Bed</span>
                  <strong>{s.beds.find((b) => b.id === r.bedId)?.label}</strong>
                </div>
                <div className="report-row">
                  <span>Expected check-in</span>
                  <strong>{displayDate(r.checkIn)}</strong>
                </div>
                <div className="report-row">
                  <span>Hold bed until</span>
                  <strong>{displayDate(r.expires)}</strong>
                </div>
                <div className="report-row">
                  <span>Booking money received</span>
                  <strong>{rupees(r.amount)}</strong>
                </div>
                {r.amount > 0 && (
                  <small className="muted">
                    Booking money is separate from rent. Record a refund or use
                    it for rent yourself.
                  </small>
                )}
                <p>{r.notes}</p>
                {activeReservation(r) && (
                  <div className="button-row">
                    {r.status === "Pending" ? (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            service.reservationStatus(r.id, "Confirmed"),
                          )
                        }
                      >
                        Confirm
                      </Button>
                    ) : (
                      <Button
                        onClick={() =>
                          open({
                            kind: "tenant",
                            reservationId: r.id,
                            bedId: r.bedId,
                          })
                        }
                      >
                        Check in
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => setCancel(r.id)}>
                      Cancel booking
                    </Button>
                  </div>
                )}
              </section>
            ))}
        </div>
      )}
      {isMaint && (
        <div className="operation-grid">
          {s.tickets
            .filter((t) => filter === "All" || t.status === filter)
            .map((t) => (
              <section className="panel operation-card" key={t.id}>
                <div className="operation-top">
                  <span className="metric-icon rose">
                    <Wrench size={21} />
                  </span>
                  <Badge
                    status={
                      t.priority === "Urgent" || t.priority === "High"
                        ? "Overdue"
                        : "Reserved"
                    }
                  >
                    {t.priority}
                  </Badge>
                </div>
                <small className="muted">
                  REQUEST #{t.id.slice(0, 6).toUpperCase()} · {t.category}
                </small>
                <h3>{t.description}</h3>
                <p>
                  Room {s.rooms.find((r) => r.id === t.roomId)?.number}
                  {t.bedId &&
                    ` · Bed ${s.beds.find((b) => b.id === t.bedId)?.label}`}
                </p>
                <div className="button-row">
                  <Badge status={t.status === "Resolved" ? "Paid" : "Reserved"}>
                    {t.status}
                  </Badge>
                  {t.block && (
                    <Badge status="Maintenance">
                      Bed cannot be booked until fixed
                    </Badge>
                  )}
                </div>
                {t.resolution && <p>{t.resolution}</p>}
                <div className="button-row">
                  {t.status === "Open" && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run(() => service.ticketStatus(t.id, "In Progress", ""))
                      }
                    >
                      Start work
                    </Button>
                  )}
                  {["Open", "In Progress"].includes(t.status) && (
                    <Button onClick={() => setResolve(t.id)}>
                      Mark as fixed
                    </Button>
                  )}
                  {t.status === "Resolved" && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run(() =>
                          service.ticketStatus(t.id, "Closed", t.resolution),
                        )
                      }
                    >
                      Close request
                    </Button>
                  )}
                </div>
              </section>
            ))}
        </div>
      )}
      {isNot && (
        <div className="notification-layout">
          <section className="panel">
            <div className="section-title">
              <h2>Recent updates</h2>
              <Badge>
                {s.notifications.filter((n) => !n.read).length} unread
              </Badge>
            </div>
            {[...s.notifications].reverse().map((n) => (
              <div
                className={`notification-row ${!n.read ? "unread" : ""}`}
                key={n.id}
              >
                <span className="metric-icon purple">
                  <Bell size={18} />
                </span>
                <div>
                  <Link to={n.href}>
                    <strong>{plainActivity(n.title)}</strong>
                  </Link>
                  <p>{plainActivity(n.message)}</p>
                  <small>{displayDateTime(n.createdAt)}</small>
                </div>
                {!n.read && (
                  <Button
                    variant="ghost"
                    disabled={busy}
                    aria-label={`Mark ${n.title} read`}
                    onClick={() => run(() => service.markRead(n.id))}
                  >
                    <CheckCheck size={17} />
                  </Button>
                )}
              </div>
            ))}
            {!s.notifications.length && <Empty title="You’re all caught up" />}
          </section>
          <section className="panel">
            <div className="section-title">
              <h2>Live reminders</h2>
              <Clock3 size={19} />
            </div>
            <p className="muted">
              These reminders come from unpaid rent, bookings, and open repair
              requests. Open the related item to update it.
            </p>
            {alerts.map((a) => (
              <Link className="reminder" to={a.href} key={a.id}>
                <strong>{a.title}</strong>
                <p>{a.text}</p>
              </Link>
            ))}
            {!alerts.length && <Empty title="No reminders" />}
          </section>
        </div>
      )}
      {page === "activity" && (
        <section className="panel">
          <div className="activity-list">
            {[...s.audit].reverse().map((a) => (
              <div key={a.id}>
                <span className="timeline-dot" />
                <div>
                  <strong>{plainActivity(a.action)}</strong>
                  <p>{plainActivity(a.detail)}</p>
                  <small>{displayDateTime(a.createdAt)}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {resolve && (
        <Modal title="Mark repair as fixed" onClose={() => setResolve("")}>
          <div className="dialog-body">
            <Field label="What was fixed?">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
            <p>
              If this repair blocked a bed, the bed will become available again.
            </p>
            <Button
              disabled={busy || notes.trim().length < 3}
              onClick={() =>
                run(() => service.ticketStatus(resolve, "Resolved", notes))
              }
            >
              Save as fixed
            </Button>
          </div>
        </Modal>
      )}
      {cancel && (
        <Modal title="Cancel reservation?" onClose={() => setCancel("")}>
          <div className="dialog-body">
            <p>
              The bed will become available. Any booking money will stay in the
              record; return it separately if needed.
            </p>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                run(() => service.reservationStatus(cancel, "Cancelled"))
              }
            >
              Cancel reservation
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
