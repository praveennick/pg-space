import { useMemo, useState } from "react";
import { MessageSquareText, Search, Sparkles } from "lucide-react";
import { useApp } from "../hooks/useApp";
import { WhatsAppReminder } from "../components/WhatsAppReminder";
import { Empty } from "../components/ui";
import { balance } from "../domain/calculations";
import { displayDate } from "../domain/dates";
import { rupees } from "../domain/models";

export default function Reminders() {
  const { s } = useApp();
  const [q, setQ] = useState("");

  const rows = useMemo(
    () =>
      s.invoices
        .filter((invoice) => balance(s, invoice) > 0)
        .map((invoice) => {
          const tenant = s.tenants.find((item) => item.id === invoice.tenantId);
          const occupancy = s.occupancies.find(
            (item) => item.id === invoice.occupancyId,
          );
          const bed = occupancy
            ? s.beds.find((item) => item.id === occupancy.bedId)
            : null;
          const room = bed
            ? s.rooms.find((item) => item.id === bed.roomId)
            : null;
          return {
            invoice,
            tenant,
            roomLabel: room?.number || bed?.label || "Room",
            dueDate: displayDate(invoice.due),
            amountDue: balance(s, invoice),
          };
        })
        .filter(({ tenant, roomLabel }) => {
          const haystack =
            `${tenant?.name ?? ""} ${tenant?.phone ?? ""} ${roomLabel}`.toLowerCase();
          return haystack.includes(q.toLowerCase());
        })
        .sort((a, b) => a.invoice.due.localeCompare(b.invoice.due)),
    [q, s],
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">WHATSAPP MESSAGES</div>
          <h1>Rent reminders</h1>
          <p>
            Send a personal reminder to each resident who still owes rent.
          </p>
        </div>
      </div>

      <section className="panel">
        <div className="list-toolbar finance-toolbar">
          <div className="input-search">
            <Search size={16} />
            <input
              aria-label="Search reminders"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search tenant or room…"
            />
          </div>
        </div>

        {rows.length ? (
          <div className="reminder-list">
            {rows.map(({ invoice, tenant, roomLabel, dueDate, amountDue }) => (
              <div className="reminder-card" key={invoice.id}>
                <div className="reminder-card-main">
                  <span className="metric-icon purple">
                    <MessageSquareText size={17} />
                  </span>
                  <div>
                    <strong>{tenant?.name ?? "Unknown tenant"}</strong>
                    <p>
                      {roomLabel} · Due {dueDate}
                    </p>
                  </div>
                </div>
                <div className="reminder-card-meta">
                  <div>
                    <small>Outstanding</small>
                    <strong>{rupees(amountDue)}</strong>
                  </div>
                  <div>
                    <small>Contact</small>
                    <strong>{tenant?.phone || "No number saved"}</strong>
                  </div>
                </div>
                <div className="reminder-card-actions">
                  <WhatsAppReminder
                    tenantId={tenant?.id || ""}
                    invoiceId={invoice.id}
                    label="Send reminder"
                    className="reminder-inline"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="No reminders needed"
            description="All rent is paid and settling, or there are no outstanding bills yet."
          />
        )}
      </section>
      <p className="local-note">
        <Sparkles size={14} /> These reminders use WhatsApp Click-to-Chat and
        open the chat in the device app or browser.
      </p>
    </>
  );
}
