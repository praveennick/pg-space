import type { FormEvent } from "react";
import {
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  CircleHelp,
  Clock3,
  CreditCard,
  FileText,
  LogOut,
  Mail,
  Phone,
  RotateCcw,
  Send,
  ShieldCheck,
  UserRound,
  Wallet,
  Wrench,
} from "lucide-react";
import { rupees, type Entities } from "../domain/models";
import { displayDate, displayMonth } from "../domain/dates";
import { Button, Field } from "./ui";
import { ThemeToggle } from "./ThemeToggle";
import "./TenantPortalView.css";

export type TenantPortalRecords = {
  profile: Pick<
    Entities["tenants"],
    "name" | "phone" | "email" | "occupation"
  > | null;
  stays: Entities["occupancies"][];
  invoices: Entities["invoices"][];
  payments: Entities["payments"][];
  tickets: Entities["tickets"][];
};
type Props = {
  records: TenantPortalRecords | null;
  busy: boolean;
  ended: boolean;
  error: string;
  sending: boolean;
  category: string;
  description: string;
  ticketMessage: string;
  ticketFailed: boolean;
  onCategory: (category: string) => void;
  onDescription: (description: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRefresh: () => void;
  onSignOut: () => void;
};

function RequestProgress({
  status,
}: {
  status: Entities["tickets"]["status"];
}) {
  const step = status === "Open" ? 0 : status === "In Progress" ? 1 : 2;
  return (
    <ol className="resident-request-progress" aria-label="Request progress">
      {["Sent", "In progress", "Finished"].map((label, index) => (
        <li
          key={label}
          className={index <= step ? "reached" : ""}
          aria-current={index === step ? "step" : undefined}
        >
          <span>{index < step ? <Check size={11} /> : index + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

export function TenantPortalView({
  records,
  busy,
  ended,
  error,
  sending,
  category,
  description,
  ticketMessage,
  ticketFailed,
  onCategory,
  onDescription,
  onSubmit,
  onRefresh,
  onSignOut,
}: Props) {
  const stay = records?.stays.find((item) => !item.end);
  const profile = records?.profile;
  const name = profile?.name || "Resident";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  const open =
    records?.tickets.filter(
      (item) => !["Resolved", "Closed"].includes(item.status),
    ).length || 0;
  return (
    <div className="tenant-portal resident-space">
      <header className="resident-header">
        <div className="resident-header-inner">
          <div className="resident-brand">
            <span>
              <Building2 size={23} />
            </span>
            <div>
              <strong>PG Space</strong>
              <small>Resident account</small>
            </div>
          </div>
          <div className="resident-header-actions">
            <ThemeToggle />
            <Button variant="outline" onClick={onSignOut}>
              <LogOut size={16} />
              <span>Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="resident-main">
        {error && (
          <div className="resident-notice is-error" role="alert">
            <CircleHelp size={18} />
            <span>{error}</span>
          </div>
        )}
        {ended ? (
          <section className="resident-card resident-unavailable">
            <ShieldCheck size={36} />
            <h1>Your PG access has ended</h1>
            <p>
              Please contact the PG office if you need help with your past stay.
            </p>
          </section>
        ) : (
          <>
            <section className="resident-welcome">
              <div className="resident-welcome-copy">
                <span className="resident-overline">YOUR PG ACCOUNT</span>
                <h1>
                  {profile
                    ? `Hi, ${name.split(/\s+/)[0]}.`
                    : "Welcome to your PG account."}
                </h1>
                <p>
                  Your stay, rent and help from the PG team, all in one place.
                </p>
                <div className="resident-welcome-actions">
                  <a className="btn btn-default" href="#resident-help">
                    <Wrench size={16} />
                    Get help
                  </a>
                  <a className="btn btn-outline" href="#resident-bills">
                    <FileText size={16} />
                    View rent bills
                  </a>
                </div>
              </div>
              <div className="resident-identity">
                <span className="resident-avatar" aria-hidden="true">
                  {initials}
                </span>
                <strong>{name}</strong>
                <span className="resident-stay-status">
                  <span />
                  {stay
                    ? "Currently staying"
                    : busy
                      ? "Loading your stay…"
                      : "No current stay"}
                </span>
              </div>
            </section>
            <div className="resident-toolbar">
              <p>
                <ShieldCheck size={15} />
                Private to your account
              </p>
              <Button variant="ghost" disabled={busy} onClick={onRefresh}>
                <RotateCcw size={15} className={busy ? "spinner" : undefined} />
                {busy ? "Refreshing…" : "Refresh"}
              </Button>
            </div>
            {!records && busy && (
              <div className="resident-loading" role="status">
                Loading your records…
              </div>
            )}
            {!records && !busy && (
              <section className="resident-card">
                <h2>Your records could not be loaded</h2>
                <p>Please try Refresh, or contact the PG office.</p>
              </section>
            )}
            {records && (
              <>
                <div className="resident-summary">
                  <section className="resident-summary-card">
                    <span className="resident-icon">
                      <Wallet size={21} />
                    </span>
                    <div>
                      <small>Monthly rent</small>
                      <strong>
                        {stay ? rupees(stay.rent) : "Not recorded"}
                      </strong>
                      <p>
                        {stay
                          ? `Check-in: ${displayDate(stay.start)}`
                          : "Contact the PG office for your stay details."}
                      </p>
                    </div>
                  </section>
                  <section className="resident-summary-card">
                    <span className="resident-icon warm">
                      <Wrench size={21} />
                    </span>
                    <div>
                      <small>Open repair requests</small>
                      <strong>{open.toString().padStart(2, "0")}</strong>
                      <p>
                        {open
                          ? "Your PG team will update the status below."
                          : "No requests waiting for the PG team."}
                      </p>
                    </div>
                  </section>
                </div>
                <div className="resident-columns">
                  <div className="resident-column">
                    <section
                      className="resident-card"
                      aria-labelledby="resident-requests-title"
                    >
                      <div className="resident-card-heading">
                        <div>
                          <span className="resident-overline">
                            HELP FROM YOUR PG
                          </span>
                          <h2 id="resident-requests-title">
                            My repair requests
                          </h2>
                        </div>
                        <span className="resident-count">
                          {records.tickets.length} total
                        </span>
                      </div>
                      <p className="resident-card-subtitle">
                        Follow your requests here. Your PG team updates the
                        status.
                      </p>
                      {records.tickets.length ? (
                        <div className="resident-request-list">
                          {records.tickets.map((ticket) => (
                            <article
                              className="resident-request"
                              key={ticket.id}
                            >
                              <div className="resident-request-heading">
                                <span className="resident-icon small">
                                  <Wrench size={17} />
                                </span>
                                <div>
                                  <h3>{ticket.category}</h3>
                                  <small>
                                    {displayDate(ticket.createdAt.slice(0, 10))}
                                  </small>
                                </div>
                                <span
                                  className={`resident-status ${["Resolved", "Closed"].includes(ticket.status) ? "finished" : ""}`}
                                >
                                  {ticket.status}
                                </span>
                              </div>
                              <p className="resident-request-description">
                                {ticket.description}
                              </p>
                              <RequestProgress status={ticket.status} />
                              {ticket.resolution && (
                                <p className="resident-team-reply">
                                  <CheckCheck size={16} />
                                  <span>
                                    <strong>From your PG team</strong>
                                    {ticket.resolution}
                                  </span>
                                </p>
                              )}
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="resident-empty">
                          <span className="resident-icon">
                            <CheckCheck size={25} />
                          </span>
                          <h3>No repair requests yet</h3>
                          <p>
                            Something needs fixing? Tell us using the help form.
                          </p>
                        </div>
                      )}
                    </section>
                    <section id="resident-bills" className="resident-card">
                      <div className="resident-card-heading">
                        <div>
                          <span className="resident-overline">
                            RENT RECORDS
                          </span>
                          <h2>My rent bills</h2>
                        </div>
                        <span className="resident-icon small">
                          <FileText size={19} />
                        </span>
                      </div>
                      {records.invoices.length ? (
                        <div className="resident-records">
                          {records.invoices.map((bill) => (
                            <div className="resident-record" key={bill.id}>
                              <span className="resident-record-icon">
                                <CalendarDays size={19} />
                              </span>
                              <div>
                                <strong>{displayMonth(bill.month)}</strong>
                                <small>Due {displayDate(bill.due)}</small>
                              </div>
                              <div className="resident-record-amount">
                                <strong>{rupees(bill.amount)}</strong>
                                <small>Bill amount</small>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="resident-inline-empty">
                          No rent bills found.
                        </p>
                      )}
                      <p className="resident-footnote">
                        <CircleHelp size={15} />
                        For the amount left to pay, please contact the PG
                        office.
                      </p>
                    </section>
                    <section className="resident-card">
                      <div className="resident-card-heading">
                        <div>
                          <span className="resident-overline">
                            MONEY RECEIVED
                          </span>
                          <h2>My payments</h2>
                        </div>
                        <span className="resident-icon small">
                          <CreditCard size={19} />
                        </span>
                      </div>
                      {records.payments.length ? (
                        <div className="resident-records">
                          {records.payments.map((payment) => (
                            <div className="resident-record" key={payment.id}>
                              <span className="resident-record-icon payment">
                                <Check size={18} />
                              </span>
                              <div>
                                <strong>{displayDate(payment.date)}</strong>
                                <small>{payment.method}</small>
                              </div>
                              <div className="resident-record-amount">
                                <strong>{rupees(payment.amount)}</strong>
                                <small className="resident-payment-label">
                                  Received
                                </small>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="resident-inline-empty">
                          No payments recorded yet.
                        </p>
                      )}
                    </section>
                  </div>
                  <div className="resident-column">
                    <section
                      id="resident-help"
                      className="resident-card resident-help-card"
                    >
                      <div className="resident-card-heading">
                        <div>
                          <span className="resident-overline">
                            SOMETHING NEEDS FIXING?
                          </span>
                          <h2>Repairs & help</h2>
                        </div>
                        <span className="resident-icon small">
                          <CircleHelp size={20} />
                        </span>
                      </div>
                      <p className="resident-card-subtitle">
                        Tell us what happened. The PG team will take it from
                        here.
                      </p>
                      {stay ? (
                        <form
                          className="resident-help-form"
                          onSubmit={onSubmit}
                        >
                          <Field label="What do you need help with?">
                            <select
                              value={category}
                              onChange={(event) =>
                                onCategory(event.target.value)
                              }
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
                              onChange={(event) =>
                                onDescription(event.target.value)
                              }
                              placeholder="For example: The fan above my bed is not working."
                            />
                          </Field>
                          <Button disabled={sending}>
                            <Send size={16} />
                            {sending ? "Sending…" : "Send repair request"}
                          </Button>
                          <p className="resident-form-hint">
                            <Clock3 size={14} />
                            You can follow its status under My repair requests.
                          </p>
                        </form>
                      ) : (
                        <p className="resident-inline-empty">
                          Contact the PG office to check your stay before
                          raising a request.
                        </p>
                      )}
                      {ticketMessage && (
                        <p
                          className={`resident-notice ${ticketFailed ? "is-error" : "is-success"}`}
                          role={ticketFailed ? "alert" : "status"}
                        >
                          {ticketMessage}
                        </p>
                      )}
                    </section>
                    <section className="resident-card">
                      <div className="resident-card-heading">
                        <div>
                          <span className="resident-overline">
                            YOUR DETAILS
                          </span>
                          <h2>My profile</h2>
                        </div>
                        <span className="resident-icon small">
                          <UserRound size={19} />
                        </span>
                      </div>
                      {profile ? (
                        <dl className="resident-profile-details">
                          <div>
                            <dt>
                              <UserRound size={16} />
                              Name
                            </dt>
                            <dd>{profile.name}</dd>
                          </div>
                          <div>
                            <dt>
                              <Phone size={16} />
                              Phone
                            </dt>
                            <dd>{profile.phone || "Not recorded"}</dd>
                          </div>
                          <div>
                            <dt>
                              <Mail size={16} />
                              Email
                            </dt>
                            <dd>{profile.email || "Not recorded"}</dd>
                          </div>
                          <div>
                            <dt>
                              <CalendarDays size={16} />
                              Check-in
                            </dt>
                            <dd>
                              {displayDate(stay?.start) || "No current stay"}
                            </dd>
                          </div>
                          {profile.occupation && (
                            <div>
                              <dt>
                                <Building2 size={16} />
                                Occupation
                              </dt>
                              <dd>{profile.occupation}</dd>
                            </div>
                          )}
                        </dl>
                      ) : (
                        <p className="resident-inline-empty">
                          Ask the PG manager to check your profile details.
                        </p>
                      )}
                      <p className="resident-footnote">
                        Need to change your details? Please contact the PG
                        office.
                      </p>
                    </section>
                  </div>
                </div>
                <footer className="resident-footer">
                  <Building2 size={16} />
                  <span>PG Space</span>
                  <span>Your resident account</span>
                </footer>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
