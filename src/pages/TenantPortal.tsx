import { useCallback, useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { LogOut, RotateCcw } from "lucide-react";
import { useAccess } from "../auth/access";
import { cloudAuth, cloudDb } from "../data/firebase";
import { displayDate, displayMonth } from "../domain/dates";
import { rupees, type Entities } from "../domain/models";
import { Button, SectionTitle } from "../components/ui";

type OwnRecords = {
  profile: Pick<
    Entities["tenants"],
    "name" | "phone" | "email" | "occupation"
  > | null;
  stays: Entities["occupancies"][];
  invoices: Entities["invoices"][];
  payments: Entities["payments"][];
};

export default function TenantPortal() {
  const { ownerUid, tenantId } = useAccess();
  const [records, setRecords] = useState<OwnRecords | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!cloudDb || !tenantId)
      throw new Error("No resident is linked to this account.");
    const database = cloudDb;
    const path = (entity: string) =>
      collection(database, "accounts", ownerUid, "records", entity, "items");
    const [profile, stays, invoices, payments] = await Promise.all([
      getDoc(doc(cloudDb, "accounts", ownerUid, "portal", tenantId)),
      getDocs(query(path("occupancies"), where("tenantId", "==", tenantId))),
      getDocs(query(path("invoices"), where("tenantId", "==", tenantId))),
      getDocs(query(path("payments"), where("tenantId", "==", tenantId))),
    ]);
    return {
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
        if (active) setRecords(data);
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
        <Button
          variant="outline"
          onClick={() => cloudAuth && void signOut(cloudAuth)}
        >
          <LogOut size={16} /> Sign out
        </Button>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">YOUR PG ACCOUNT</div>
            <h1>Hello{records?.profile ? `, ${records.profile.name}` : ""}</h1>
            <p>See your stay, rent bills and payments.</p>
          </div>
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                setRecords(await load());
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
        {records && (
          <div className="tenant-portal-grid">
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
