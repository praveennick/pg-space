import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Plus,
  Search,
  ArrowRightLeft,
  LogOut,
  Pencil,
  Wallet,
} from "lucide-react";
import { useApp } from "../hooks/useApp";
import { displayDate, displayMonth } from "../domain/dates";
import { balance, depositHeld, invoiceStatus } from "../domain/calculations";
import { rupees } from "../domain/models";
import { Button, Badge, Empty, Modal } from "../components/ui";
import { rentStatusLabel } from "../components/labels";
import { TenantAvatar } from "../components/TenantPhoto";
import { WhatsAppReminder } from "../components/WhatsAppReminder";
export default function Tenants() {
  const { s, open } = useApp(),
    { id } = useParams(),
    navigate = useNavigate(),
    [q, setQ] = useState(""),
    [filter, setFilter] = useState("Active"),
    [page, setPage] = useState(1),
    [tab, setTab] = useState("Overview"),
    [cards, setCards] = useState(false);
  const active = (id: string) =>
    s.occupancies.find((o) => o.tenantId === id && !o.end);
  const list = s.tenants
    .filter(
      (t) =>
        (t.name + " " + t.phone + " " + t.email)
          .toLowerCase()
          .includes(q.toLowerCase()) &&
        (filter === "All" || (filter === "Active") === !!active(t.id)),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const tenant = s.tenants.find((t) => t.id === id),
    stay = tenant && active(tenant.id),
    bed = s.beds.find((b) => b.id === stay?.bedId);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PEOPLE STAYING HERE</div>
          <h1>Your residents</h1>
          <p>See who lives here, their bed, rent, and contact details.</p>
        </div>
        <Button onClick={() => open({ kind: "tenant" })}>
          <Plus size={17} /> Add tenant
        </Button>
      </div>
      <section className="panel">
        <div className="list-toolbar tenant-toolbar">
          <div className="input-search">
            <Search size={17} />
            <input
              placeholder="Search name, phone or email…"
              aria-label="Search tenants"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            aria-label="Tenant status"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            {["Active", "All", "Checked out"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <Button variant="outline" onClick={() => setCards(!cards)}>
            {cards ? "Table view" : "Card view"}
          </Button>
          <span className="muted">{list.length} residents</span>
        </div>
        {list.length ? (
          cards ? (
            <div className="tenant-grid">
              {list.slice((page - 1) * 12, page * 12).map((t) => {
                const occupancy = active(t.id);
                const pending = s.invoices
                  .filter((invoice) => invoice.tenantId === t.id)
                  .reduce((total, invoice) => total + balance(s, invoice), 0);
                return (
                  <button
                    className="tenant-card"
                    key={t.id}
                    onClick={() => navigate(`/app/tenants/${t.id}`)}
                  >
                    <TenantAvatar tenant={t} className="large" />
                    <h3>{t.name.replace(" (Demo)", "")}</h3>
                    <p>{t.occupation}</p>
                    <Badge status={active(t.id) ? "Occupied" : "neutral"}>
                      {active(t.id)
                        ? s.beds.find((b) => b.id === active(t.id)?.bedId)
                            ?.label
                        : "Checked out"}
                    </Badge>
                    <span className="tenant-card-details">
                      <span>
                        <small>Phone</small>
                        <strong>{t.phone || "—"}</strong>
                      </span>
                      <span>
                        <small>Check-in</small>
                        <strong>{displayDate(occupancy?.start) || "—"}</strong>
                      </span>
                      <span>
                        <small>Monthly rent</small>
                        <strong>
                          {occupancy ? rupees(occupancy.rent) : "—"}
                        </strong>
                      </span>
                      <span>
                        <small>Rent due</small>
                        <strong>{rupees(pending)}</strong>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {[
                      "Resident",
                      "Room / Bed",
                      "Check-in",
                      "Monthly rent",
                      "Rent due",
                      "Status",
                      "",
                    ].map((h, i) => (
                      <th key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.slice((page - 1) * 12, page * 12).map((t, i) => {
                    const o = active(t.id),
                      b = s.beds.find((b) => b.id === o?.bedId),
                      pending = s.invoices
                        .filter((v) => v.tenantId === t.id)
                        .reduce((v, i) => v + balance(s, i), 0);
                    return (
                      <tr key={t.id}>
                        <td data-label="Resident">
                          <button
                            className="person person-button"
                            onClick={() => navigate(`/app/tenants/${t.id}`)}
                          >
                            <TenantAvatar
                              tenant={t}
                              className={`avatar-${i % 4}`}
                            />
                            <span>
                              <strong>{t.name.replace(" (Demo)", "")}</strong>
                              <small>{t.phone}</small>
                            </span>
                          </button>
                        </td>
                        <td data-label="Room / Bed">{b?.label || "—"}</td>
                        <td data-label="Check-in">
                          {displayDate(o?.start) || "—"}
                        </td>
                        <td data-label="Monthly rent">
                          {o ? rupees(o.rent) : "—"}
                        </td>
                        <td
                          data-label="Rent due"
                          className={pending ? "warning-text" : ""}
                        >
                          {rupees(pending)}
                        </td>
                        <td data-label="Status">
                          <Badge status={o ? "Occupied" : "neutral"}>
                            {o ? "Active" : "Checked out"}
                          </Badge>
                        </td>
                        <td data-label="">
                          <Button
                            variant="ghost"
                            onClick={() => navigate(`/app/tenants/${t.id}`)}
                          >
                            View profile
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <Empty title="No residents found" />
        )}
        <div className="pagination">
          <span>
            {list.length} residents · Page {page}
          </span>
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={page * 12 >= list.length}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </section>
      {tenant && (
        <Modal
          wide
          title="Resident profile"
          onClose={() => navigate("/app/tenants")}
        >
          <div className="dialog-body">
            <div className="profile-heading">
              <TenantAvatar tenant={tenant} className="large" />
              <div>
                <h2>{tenant.name}</h2>
                <p>
                  {tenant.occupation} · {tenant.phone}
                </p>
                <Badge status={stay ? "Occupied" : "neutral"}>
                  {stay ? `Active · Bed ${bed?.label}` : "Checked out"}
                </Badge>
                <Button
                  variant="ghost"
                  onClick={() => open({ kind: "tenant", id: tenant.id })}
                >
                  {tenant.photo ? "Replace or remove photo" : "Add photo"}
                </Button>
              </div>
            </div>
            <div className="tabs" aria-label="Resident profile sections">
              {[
                "Overview",
                "Payments",
                "Stay History",
                "ID check",
                "Complaints",
                "Activity",
              ].map((v) => (
                <button
                  key={v}
                  className={tab === v ? "active" : ""}
                  aria-pressed={tab === v}
                  onClick={() => setTab(v)}
                >
                  {v}
                </button>
              ))}
            </div>
            {tab === "Overview" && (
              <>
                <div className="detail-metrics">
                  <div>
                    <small>Monthly rent</small>
                    <strong>{rupees(stay?.rent || 0)}</strong>
                  </div>
                  <div>
                    <small>Deposit money held</small>
                    <strong>{rupees(depositHeld(s, tenant.id))}</strong>
                  </div>
                  <div>
                    <small>Rent still due</small>
                    <strong>
                      {rupees(
                        s.invoices
                          .filter((i) => i.tenantId === tenant.id)
                          .reduce((v, i) => v + balance(s, i), 0),
                      )}
                    </strong>
                  </div>
                </div>
                <div className="info-grid">
                  <div>
                    <small>Email</small>
                    <p>{tenant.email || "Not provided"}</p>
                  </div>
                  <div>
                    <small>Address</small>
                    <p>{tenant.address || "Not provided"}</p>
                  </div>
                  <div>
                    <small>Emergency contact</small>
                    <p>{tenant.emergency || "Not provided"}</p>
                  </div>
                  <div>
                    <small>Notes</small>
                    <p>{tenant.notes || "No notes"}</p>
                  </div>
                </div>
                <div className="button-row">
                  <Button
                    variant="outline"
                    onClick={() => open({ kind: "tenant", id: tenant.id })}
                  >
                    <Pencil size={15} /> Edit details
                  </Button>
                  <WhatsAppReminder
                    tenantId={tenant.id}
                    label="WhatsApp reminder"
                    className="reminder-inline"
                  />
                  <Button
                    variant="outline"
                    onClick={() => open({ kind: "deposit", id: tenant.id })}
                  >
                    <Wallet size={15} /> Deposit history
                  </Button>
                  {stay && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() =>
                          open({ kind: "transfer", id: tenant.id })
                        }
                      >
                        <ArrowRightLeft size={15} /> Transfer
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() =>
                          open({ kind: "checkout", id: tenant.id })
                        }
                      >
                        <LogOut size={15} /> Checkout
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}
            {tab === "Payments" &&
              s.invoices
                .filter((i) => i.tenantId === tenant.id)
                .map((i) => (
                  <div className="report-row" key={i.id}>
                    <span>
                      {displayMonth(i.month)}
                      <Badge status={invoiceStatus(s, i)}>
                        {rentStatusLabel(invoiceStatus(s, i))}
                      </Badge>
                    </span>
                    <strong>{rupees(balance(s, i))} due</strong>
                    {balance(s, i) > 0 && (
                      <Button
                        onClick={() => open({ kind: "payment", id: i.id })}
                      >
                        Collect
                      </Button>
                    )}
                  </div>
                ))}
            {tab === "Stay History" &&
              s.occupancies
                .filter((o) => o.tenantId === tenant.id)
                .map((o) => (
                  <div className="report-row" key={o.id}>
                    <strong>
                      {s.beds.find((b) => b.id === o.bedId)?.label}
                    </strong>
                    <span>
                      {displayDate(o.start)} →{" "}
                      {o.end ? displayDate(o.end) : "Present"}
                    </span>
                  </div>
                ))}
            {tab === "ID check" && (
              <>
                <h3>Identity verification</h3>
                <div className="info-grid">
                  <div>
                    <small>Status</small>
                    <p>{tenant.verification?.status || "Not checked"}</p>
                  </div>
                  <div>
                    <small>ID checked</small>
                    <p>{tenant.verification?.method || "Not recorded"}</p>
                  </div>
                  <div>
                    <small>Date checked</small>
                    <p>
                      {displayDate(tenant.verification?.date) || "Not recorded"}
                    </p>
                  </div>
                  <div>
                    <small>Checked by</small>
                    <p>{tenant.verification?.staff || "Not recorded"}</p>
                  </div>
                  {tenant.verification?.method ===
                    "Aadhaar checked in person" && (
                    <div>
                      <small>Voluntary consent</small>
                      <p>
                        {tenant.verification.consent
                          ? "Recorded"
                          : "Not recorded"}
                      </p>
                    </div>
                  )}
                </div>
                <p className="muted">
                  Document files are unavailable in this local demo. No ID
                  number is stored.
                </p>
              </>
            )}
            {tab === "Complaints" &&
              (s.tickets.filter((t) =>
                s.occupancies.some(
                  (o) => o.tenantId === tenant.id && o.bedId === t.bedId,
                ),
              ).length ? (
                s.tickets
                  .filter((t) =>
                    s.occupancies.some(
                      (o) => o.tenantId === tenant.id && o.bedId === t.bedId,
                    ),
                  )
                  .map((t) => (
                    <div className="report-row" key={t.id}>
                      {t.description}
                      <Badge>{t.status}</Badge>
                    </div>
                  ))
              ) : (
                <Empty title="No repair requests for this resident" />
              ))}
            {tab === "Activity" &&
              s.audit
                .filter((a) => a.detail.includes(tenant.name))
                .map((a) => (
                  <div className="report-row" key={a.id}>
                    <strong>{a.action}</strong>
                    <small>{a.detail}</small>
                  </div>
                ))}
          </div>
        </Modal>
      )}
    </>
  );
}
