import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAccess, type Role } from "../auth/access";
import {
  accessErrorMessage,
  listMembers,
  removeMember,
  saveMember,
  type Member,
} from "../auth/members";
import { cloudAuth, firebaseMode } from "../data/firebase";
import { useApp } from "../hooks/useApp";
import { Button, Field, Modal, SectionTitle } from "../components/ui";

const roleNames: Record<Role, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  staff: "Staff",
  tenant: "Tenant",
};

const roleHelp: Record<Role, { allowed: string; limits: string }> = {
  super_admin: {
    allowed:
      "Manage all PG records, payments, expenses, reports and settings. Add or remove people, change roles, import backups and clear all records.",
    limits:
      "Full access to this PG only. Give this role only to an owner you trust.",
  },
  admin: {
    allowed:
      "Manage rooms, residents, check-ins, checkouts, bookings, repairs, rent payments, deposits, expenses, quotations, reports and PG settings. Download backups.",
    limits:
      "Cannot add or remove users, change roles, import backups or clear all records.",
  },
  staff: {
    allowed:
      "Manage rooms and beds, edit existing residents, move beds, check residents out, manage bookings and repairs. Collect rent, record payments, use advance money for rent, view rent dues and payment history, and share receipts.",
    limits:
      "Cannot add or check in residents, create or change rent bills, edit or delete recorded payments, manage deposits or expenses, open reports, change settings or manage users.",
  },
  tenant: {
    allowed:
      "View their own profile, stay details, rent bills and payments. Raise repair requests and view their own request status.",
    limits:
      "Cannot edit requests, change their status, see other residents, access staff pages or pay online. Access ends at checkout.",
  },
};

export default function Team() {
  const { ownerUid } = useAccess();
  const ownEmail = cloudAuth?.currentUser?.email?.toLowerCase();
  const { s } = useApp();
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [tenantId, setTenantId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);

  const refresh = useCallback(async () => {
    if (!firebaseMode) return;
    setLoading(true);
    setError("");
    try {
      setMembers(await listMembers(ownerUid));
    } catch (cause) {
      setError(accessErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [ownerUid]);
  useEffect(() => {
    if (!firebaseMode) return;
    let active = true;
    void listMembers(ownerUid)
      .then((people) => {
        if (active) setMembers(people);
      })
      .catch((cause) => {
        if (active) setError(accessErrorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ownerUid]);

  const resetForm = () => {
    setEmail("");
    setLabel("");
    setRole("staff");
    setTenantId("");
    setEditing(false);
  };
  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      await saveMember(
        ownerUid,
        s.settings[0].name,
        { email, label, role, tenantId },
        s.tenants.find((tenant) => tenant.id === tenantId),
      );
      resetForm();
      toast.success(
        "Access saved. They can request a password link on the app's sign-in page.",
      );
      await refresh();
    } catch (cause) {
      toast.error(accessErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  if (!firebaseMode)
    return (
      <section className="panel">
        <h1>Team & access</h1>
        <p>
          Sign in to the Firebase version to add people. The local demo does not
          create user accounts.
        </p>
      </section>
    );

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">WHO CAN USE THIS PG</div>
          <h1>Team & access</h1>
          <p>Add a person's email and choose what they can do.</p>
        </div>
      </div>
      <div className="settings-grid">
        <form className="panel" onSubmit={add}>
          <SectionTitle
            title={editing ? "Update access" : "Add a person"}
            action={<UserPlus size={22} />}
          />
          <div className="form-grid">
            <Field label="Email address">
              <input
                type="email"
                autoComplete="email"
                required
                readOnly={editing}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field label="Name (optional)">
              <input
                maxLength={100}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </Field>
            <Field label="Access level">
              <select
                value={role}
                aria-describedby="access-level-details"
                onChange={(event) => setRole(event.target.value as Role)}
              >
                <option value="super_admin">Super admin</option>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
                <option value="tenant">Tenant</option>
              </select>
            </Field>
            {role === "tenant" && (
              <Field label="Resident">
                <select
                  required
                  value={tenantId}
                  onChange={(event) => setTenantId(event.target.value)}
                >
                  <option value="">Choose a resident</option>
                  {s.tenants
                    .filter((tenant) =>
                      s.occupancies.some(
                        (stay) => stay.tenantId === tenant.id && !stay.end,
                      ),
                    )
                    .map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </option>
                    ))}
                </select>
              </Field>
            )}
          </div>
          <section
            id="access-level-details"
            className="access-description"
            aria-live="polite"
            aria-atomic="true"
          >
            <h3>{roleNames[role]} access</h3>
            <p>
              <strong>Can do:</strong> {roleHelp[role].allowed}
            </p>
            <p>
              <strong>Limits:</strong> {roleHelp[role].limits}
            </p>
          </section>
          <div className="button-row">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save access"}
            </Button>
            {editing && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={resetForm}
              >
                Cancel edit
              </Button>
            )}
          </div>
        </form>
        <section className="panel">
          <SectionTitle title="How they get started" />
          <p>1. Add their email here and save access.</p>
          <p>2. Share your app link with them.</p>
          <p>
            3. They choose <strong>First time? Set password</strong> and request
            an email link. They set their password through that link, then sign
            in and verify their email.
          </p>
          <p>
            The app opens their PG automatically after sign-in. Existing users
            can sign in with their current password.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  new URL("/app", window.location.origin).href,
                );
                toast.success("App link copied");
              } catch {
                toast.error(
                  "Could not copy. Share the app's address from your browser.",
                );
              }
            }}
          >
            Copy app link
          </Button>
          <p className="muted">
            Saving access does not send an invitation email. Share the link with
            the person. Firebase sends the verification email when they set
            their password.
          </p>
        </section>
      </div>
      <section className="panel data-panel">
        <SectionTitle
          title="People with access"
          action={<ShieldCheck size={22} />}
        />
        {error ? (
          <div role="alert">
            <p className="warning-text">{error}</p>
            <Button variant="outline" onClick={() => void refresh()}>
              Try again
            </Button>
          </div>
        ) : loading ? (
          <p>Loading people…</p>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Role</th>
                    <th>Linked resident</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.email}>
                      <td data-label="Person">
                        <strong>{member.label || member.email}</strong>
                        {member.label && (
                          <small className="access-email">{member.email}</small>
                        )}
                      </td>
                      <td data-label="Role">
                        {roleNames[member.role]}
                        {member.revoked && (
                          <small className="access-email">
                            Access blocked — removal needs retry
                          </small>
                        )}
                      </td>
                      <td data-label="Linked resident">
                        {s.tenants.find(
                          (tenant) => tenant.id === member.tenantId,
                        )?.name || "—"}
                      </td>
                      <td data-label="Actions">
                        <div className="button-row">
                          <Button
                            variant="outline"
                            disabled={busy || member.email === ownEmail}
                            onClick={() => {
                              setEmail(member.email);
                              setLabel(member.label);
                              setRole(member.role);
                              setTenantId(member.tenantId);
                              setEditing(true);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            disabled={busy || member.email === ownEmail}
                            onClick={() => setRemoving(member)}
                          >
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!members.length && <p>No one else has access yet.</p>}
          </>
        )}
      </section>
      {removing && (
        <Modal
          title="Remove user?"
          description="This deletes their Firebase sign-in account and removes their PG access. Saved PG records and payment history are kept."
          onClose={() => {
            if (!busy) setRemoving(null);
          }}
        >
          <div className="dialog-body">
            <p>{removing.email}</p>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await removeMember(ownerUid, removing.email);
                  setRemoving(null);
                  await refresh();
                  toast.success(
                    "User removed from PG access and Firebase sign-in.",
                  );
                } catch (cause) {
                  toast.error(accessErrorMessage(cause));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Remove access
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
