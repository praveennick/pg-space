import { useCallback, useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { LogOut, RotateCcw } from "lucide-react";
import { useAccess } from "../auth/access";
import { cloudAuth, cloudDb } from "../data/firebase";
import { displayDate, displayMonth } from "../domain/dates";
import { rupees, type Entities } from "../domain/models";
import { Badge, Button, Field, SectionTitle } from "../components/ui";
import { useTheme } from "../hooks/useTheme";
import { accountAction } from "../services/accountActions";

type OwnRecords = {
  profile: Pick<
    Entities["tenants"],
    "name" | "phone" | "email" | "occupation"
  > | null;
  stays: Entities["occupancies"][];
  invoices: Entities["invoices"][];
  payments: Entities["payments"][];
  tickets: Entities["tickets"][];
};

export default function TenantPortal() {
  const { ownerUid, tenantId } = useAccess();
  const [records, setRecords] = useState<OwnRecords | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const { theme, setTheme } = useTheme();
  const [ended, setEnded] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [category, setCategory] = useState("Other");
  const [description, setDescription] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");

  useEffect(() => {
    if (!cloudDb || !tenantId || !sessionReady) return;
    return onSnapshot(
      doc(cloudDb, "accounts", ownerUid, "portal", tenantId),
      (profile) => {
        if (!profile.exists() || profile.data().active === false) {
          setEnded(true);
          setRecords(null);
        }
      },
      () => {
        setRecords(null);
        setEnded(true);
      },
    );
  }, [ownerUid, tenantId, sessionReady]);

  useEffect(() => {
    if (!cloudDb || !tenantId || ended || !sessionReady) return;
    return onSnapshot(
      query(
        collection(
          cloudDb,
          "accounts",
          ownerUid,
          "records",
          "tickets",
          "items",
        ),
        where("tenantId", "==", tenantId),
      ),
      (snapshot) => {
        const tickets = snapshot.docs
          .map((item) => item.data() as Entities["tickets"])
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setRecords((current) => (current ? { ...current, tickets } : current));
      },
      () =>
        setError("Repair status could not be refreshed. Please try Refresh."),
    );
  }, [ownerUid, tenantId, ended, sessionReady]);

  const load = useCallback(async () => {
    if (!cloudDb || !tenantId)
      throw new Error("No resident is linked to this account.");
    const database = cloudDb;
    const session = await accountAction({ action: "session", ownerUid });
    if (!session.active) return null;
    const path = (entity: string) =>
      collection(database, "accounts", ownerUid, "records", entity, "items");
    const [profile, stays, invoices, payments, tickets] = await Promise.all([
      getDoc(doc(cloudDb, "accounts", ownerUid, "portal", tenantId)),
      getDocs(query(path("occupancies"), where("tenantId", "==", tenantId))),
      getDocs(query(path("invoices"), where("tenantId", "==", tenantId))),
      getDocs(query(path("payments"), where("tenantId", "==", tenantId))),
      getDocs(query(path("tickets"), where("tenantId", "==", tenantId))),
    ]);
    return {
      tickets: tickets.docs
        .map((item) => item.data() as Entities["tickets"])
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      profile: profile.exists()
        ? (profile.data() as OwnRecords["profile"])
        : null,
      stays: stays.docs.map((item) => item.data() as Entities["occupancies"]),
      invoices: invoices.docs
        .map((item) => item.data() as Entities["invoices"])
        .sort((a, b) => b.month.localeCompare(a.month)),
      payments: payments.docs
        .map((item) => item.data() as Entities["payments"])
        .sort((a, b) => b.date.localeCompare(a.date)),
    };
  }, [ownerUid, tenantId]);

  useEffect(() => {
    let active = true;
    void load()
      .then((data) => {
        if (active) {
          setRecords(data);
          setEnded(!data);
          setSessionReady(!!data);
        }
      })
      .catch((cause) => {
        if (active) setError((cause as Error).message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [load]);

  const stay = records?.stays.find((item) => !item.end);
  return (
    <div className="tenant-portal">
      <header className="tenant-portal-header">
        <strong>PG Space</strong>
        <div className="button-row">
          <label className="tenant-theme">
            Theme
            <select
              aria-label="Colour theme"
              value={theme}
              onChange={(event) => setTheme(event.target.value)}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </label>
          <Button
            variant="outline"
            onClick={() => cloudAuth && void signOut(cloudAuth)}
          >
            <LogOut size={16} /> Sign out
          </Button>
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">YOUR PG ACCOUNT</div>
            <h1>Hello{records?.profile ? `, ${records.profile.name}` : ""}</h1>
            <p>See your stay, rent bills, payments and repair requests.</p>
          </div>
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const data = await load();
                setRecords(data);
                setEnded(!data);
                setSessionReady(!!data);
              } catch (cause) {
                setError((cause as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <RotateCcw size={16} /> Refresh
          </Button>
        </div>
        {error && (
          <p className="warning-text" role="alert">
            {error}
          </p>
        )}
        {!records && busy && <p>Loading your records…</p>}
        {ended && (
          <section className="panel">
            <h2>Your PG access has ended</h2>
            <p>
              Please contact the PG office if you need help with your past stay.
            </p>
          </section>
        )}
        {records && !ended && (
          <div className="tenant-portal-grid">
            <section className="panel tenant-ticket-panel">
              <SectionTitle title="Repairs & help" />
              <p>
                Tell us what needs fixing. The PG team will update the status
                here.
              </p>
              {stay && (
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setSending(true);
                    setTicketMessage("");
                    try {
                      await accountAction({
                        action: "ticket",
                        ownerUid,
                        category,
                        description,
                      });
                      setDescription("");
                      setTicketMessage("Your repair request was sent.");
                      try {
                        const data = await load();
                        setRecords(data);
                        setEnded(!data);
                      } catch {
                        setError(
                          "Your request was sent, but the list could not refresh. Use Refresh to check it.",
                        );
                      }
                    } catch (cause) {
                      setTicketMessage((cause as Error).message);
                    } finally {
                      setSending(false);
                    }
                  }}
                >
                  <Field label="What do you need help with?">
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                    >
                      {[
                        "Electrical",
                        "Plumbing",
                        "Cleaning",
                        "Wi-Fi",
                        "Other",
                      ].map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Describe the problem">
                    <textarea
                      required
                      minLength={3}
                      maxLength={2000}
                      rows={4}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="For example: The fan above my bed is not working."
                    />
                  </Field>
                  <Button disabled={sending}>
                    {sending ? "Sending…" : "Send repair request"}
                  </Button>
                </form>
              )}
              {ticketMessage && <p role="status">{ticketMessage}</p>}
              <h3>My requests</h3>
              {records.tickets.length ? (
                records.tickets.map((ticket) => (
                  <article className="tenant-ticket" key={ticket.id}>
                    <div className="button-row">
                      <strong>{ticket.category}</strong>
                      <Badge status={ticket.status}>{ticket.status}</Badge>
                    </div>
                    <p>{ticket.description}</p>
                    <small>{displayDate(ticket.createdAt.slice(0, 10))}</small>
                    {ticket.resolution && (
                      <p>
                        <strong>PG team:</strong> {ticket.resolution}
                      </p>
                    )}
                  </article>
                ))
              ) : (
                <p>No repair requests yet.</p>
              )}
            </section>
            <section className="panel">
              <SectionTitle title="My profile" />
              {records.profile ? (
                <div className="info-grid">
                  <div>
                    <small>Name</small>
                    <p>{records.profile.name}</p>
                  </div>
                  <div>
                    <small>Phone</small>
                    <p>{records.profile.phone}</p>
                  </div>
                  <div>
                    <small>Email</small>
                    <p>{records.profile.email || "Not recorded"}</p>
                  </div>
                  <div>
                    <small>Check-in</small>
                    <p>{displayDate(stay?.start) || "No current stay"}</p>
                  </div>
                  <div>
                    <small>Monthly rent</small>
                    <p>{stay ? rupees(stay.rent) : "—"}</p>
                  </div>
                </div>
              ) : (
                <p>
                  Your resident record is unavailable. Ask the PG manager to
                  check your access.
                </p>
              )}
            </section>
            <section className="panel">
              <SectionTitle title="My rent bills" />
              {records.invoices.length ? (
                records.invoices.map((bill) => (
                  <div className="report-row" key={bill.id}>
                    <span>
                      {displayMonth(bill.month)}{" "}
                      <small>Due {displayDate(bill.due)}</small>
                    </span>
                    <strong>{rupees(bill.amount)}</strong>
                  </div>
                ))
              ) : (
                <p>No rent bills found.</p>
              )}
              <p className="muted">
                For the current balance, contact the PG office.
              </p>
            </section>
            <section className="panel">
              <SectionTitle title="My payments" />
              {records.payments.length ? (
                records.payments.map((payment) => (
                  <div className="report-row" key={payment.id}>
                    <span>
                      {displayDate(payment.date)}{" "}
                      <small>{payment.method}</small>
                    </span>
                    <strong>{rupees(payment.amount)}</strong>
                  </div>
                ))
              ) : (
                <p>No payments found.</p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
