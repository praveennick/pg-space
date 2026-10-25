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
import { useAccess } from "../auth/access";
import { cloudAuth, cloudDb } from "../data/firebase";
import type { Entities } from "../domain/models";
import {
  TenantPortalView,
  type TenantPortalRecords as OwnRecords,
} from "../components/TenantPortalView";
import { accountAction } from "../services/accountActions";

export default function TenantPortal() {
  const { ownerUid, tenantId } = useAccess();
  const [records, setRecords] = useState<OwnRecords | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [ended, setEnded] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [category, setCategory] = useState("Other");
  const [description, setDescription] = useState("");
  const [ticketMessage, setTicketMessage] = useState("");
  const [ticketFailed, setTicketFailed] = useState(false);

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

  return (
    <TenantPortalView
      records={records}
      busy={busy}
      ended={ended}
      error={error}
      sending={sending}
      category={category}
      description={description}
      ticketMessage={ticketMessage}
      ticketFailed={ticketFailed}
      onCategory={setCategory}
      onDescription={setDescription}
      onSignOut={() => {
        if (cloudAuth) void signOut(cloudAuth);
      }}
      onRefresh={async () => {
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
      onSubmit={async (event) => {
        event.preventDefault();
        setSending(true);
        setTicketMessage("");
        setTicketFailed(false);
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
          setTicketFailed(true);
          setTicketMessage((cause as Error).message);
        } finally {
          setSending(false);
        }
      }}
    />
  );
}
