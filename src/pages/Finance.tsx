import { useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  Plus,
  Download,
  CalendarDays,
  Wallet,
  Search,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../hooks/useApp";
import {
  balance,
  invoiceStatus,
  invoicePaid,
  paymentUnallocated,
  depositHeld,
} from "../domain/calculations";
import { rupees, monthNow } from "../domain/models";
import { Button, Badge, Empty, Modal, Field } from "../components/ui";
import {
  downloadReceiptBlob,
  exportCsv,
  receipt,
  receiptPdf,
} from "../services/export";
import { service } from "../data";
import { depositActionLabel, rentStatusLabel } from "../components/labels";
import { displayDate, displayMonth } from "../domain/dates";
import { MonthInput } from "../components/MonthInput";
import { WhatsAppReminder } from "../components/WhatsAppReminder";
import { useAccess } from "../auth/access";
import {
  normalizeWhatsAppNumber,
  validateWhatsAppNumber,
} from "../services/reminders";

type ReceiptShare = {
  file: File;
  paymentId: string;
  tenantName: string;
  phone: string;
};

export default function Finance() {
  const staff = useAccess().role === "staff";
  const { s, open } = useApp(),
    location = useLocation(),
    [params] = useSearchParams(),
    isExpense = location.pathname.endsWith("expenses"),
    [month, setMonth] = useState(monthNow()),
    [filter, setFilter] = useState(params.get("status") || "Outstanding"),
    [tab, setTab] = useState("Rent dues"),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [billing, setBilling] = useState(false),
    [busy, setBusy] = useState(false),
    [preparingShare, setPreparingShare] = useState<string | null>(null),
    [receiptShare, setReceiptShare] = useState<ReceiptShare | null>(null),
    [shareBusy, setShareBusy] = useState(false),
    [shareError, setShareError] = useState(""),
    [receiptDownloaded, setReceiptDownloaded] = useState(false);
  const invoices = s.invoices.filter((i) => i.month === month),
    billed = invoices.reduce((v, i) => v + i.amount, 0),
    collected = invoices.reduce((v, i) => v + invoicePaid(s, i.id), 0),
    expenses = s.expenses.filter((e) => e.date.startsWith(month)),
    expenseTotal = expenses.reduce((v, e) => v + e.amount, 0);
  const rows = invoices.filter(
    (i) =>
      (filter === "All" ||
        (filter === "Outstanding" && balance(s, i) > 0) ||
        invoiceStatus(s, i) === filter) &&
      s.tenants
        .find((t) => t.id === i.tenantId)
        ?.name.toLowerCase()
        .includes(q.toLowerCase()),
  );
  const exportData = () =>
    exportCsv(
      isExpense ? "expenses.csv" : "rent-payments.csv",
      isExpense
        ? [
            ["Title", "Category", "Date", "INR"],
            ...expenses.map((e) => [
              e.title,
              e.category,
              displayDate(e.date),
              e.amount / 100,
            ]),
          ]
        : [
            [
              "Tenant",
              "Month",
              "Rent charged INR",
              "Rent paid INR",
              "Rent due INR",
              "Status",
            ],
            ...rows.map((i) => [
              s.tenants.find((t) => t.id === i.tenantId)?.name || "",
              displayMonth(i.month),
              i.amount / 100,
              invoicePaid(s, i.id) / 100,
              balance(s, i) / 100,
              rentStatusLabel(invoiceStatus(s, i)),
            ]),
          ],
    );

  const prepareReceiptShare = async (paymentId: string) => {
    const payment = s.payments.find((p) => p.id === paymentId);
    if (!payment) {
      toast.error("No payment record found for this receipt.");
      return;
    }
    setPreparingShare(paymentId);
    try {
      const pdfBlob = await receiptPdf(s, payment);
      const tenant = s.tenants.find((item) => item.id === payment.tenantId);
      setReceiptShare({
        file: new File([pdfBlob], `receipt-${payment.id.slice(0, 8)}.pdf`, {
          type: "application/pdf",
        }),
        paymentId: payment.id,
        tenantName: tenant?.name || "Resident",
        phone: tenant?.phone || "",
      });
      setReceiptDownloaded(false);
      setShareError("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not prepare the PDF.",
      );
    } finally {
      setPreparingShare(null);
    }
  };

  const shareReceipt = async () => {
    if (!receiptShare || typeof navigator.share !== "function") return;
    setShareBusy(true);
    setShareError("");
    try {
      // Call share immediately from this tap; generating the PDF beforehand
      // would use up the browser's required user activation.
      await navigator.share({
        files: [receiptShare.file],
        title: `Payment receipt for ${receiptShare.tenantName}`,
      });
      toast.success("PDF handed to your selected app.");
      setReceiptShare(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareError(
        "Your phone could not share this PDF. Download it and attach it in WhatsApp.",
      );
    } finally {
      setShareBusy(false);
    }
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">MONEY IN AND OUT</div>
          <h1>{isExpense ? "Expenses" : "Rent and payments"}</h1>
          <p>
            {isExpense
              ? "See what you spent this month."
              : "See rent due, payments received, and deposits."}
          </p>
        </div>
        <div className="heading-actions">
          <Button variant="outline" onClick={exportData}>
            <Download size={16} /> Export CSV
          </Button>
          <Button
            onClick={() => open({ kind: isExpense ? "expense" : "payment" })}
          >
            <Plus size={17} />
            {isExpense ? "Add expense" : "Record payment"}
          </Button>
        </div>
      </div>
      <div className="report-metrics">
        {(isExpense
          ? [
              ["Monthly expenses", expenseTotal],
              ["Categories", new Set(expenses.map((e) => e.category)).size],
              [
                "Repeat expenses",
                expenses
                  .filter((e) => e.recurring)
                  .reduce((v, e) => v + e.amount, 0),
              ],
            ]
          : [
              ["Rent charged", billed],
              ["Rent collected", collected],
              ["Rent still due", billed - collected],
              ...(!staff ? [["Deposits held", depositHeld(s)]] : []),
            ]
        ).map(([label, value]) => (
          <div className="panel" key={label}>
            <span className="metric-icon purple">
              <Wallet size={18} />
            </span>
            <small>{label}</small>
            <h2>{label === "Categories" ? value : rupees(Number(value))}</h2>
          </div>
        ))}
      </div>
      <section className="panel">
        {!isExpense && (
          <div className="tabs" aria-label="Payment views">
            {[
              "Rent dues",
              "Transactions",
              "Advances",
              ...(!staff ? ["Deposits"] : []),
            ].map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                aria-pressed={tab === t}
                onClick={() => {
                  setTab(t);
                  setPage(1);
                }}
              >
                {t === "Transactions"
                  ? "Payments received"
                  : t === "Advances"
                    ? "Advance money"
                    : t}
              </button>
            ))}
          </div>
        )}
        <div className="list-toolbar finance-toolbar">
          <div className="input-search">
            <Search size={16} />
            <input
              aria-label="Search finance records"
              placeholder={isExpense ? "Search expenses…" : "Search tenant…"}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <MonthInput
            label="Billing month"
            value={month}
            onChange={(value) => {
              setMonth(value);
              setPage(1);
            }}
          />
          {!isExpense && tab === "Rent dues" && (
            <>
              <select
                aria-label="Payment status"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setPage(1);
                }}
              >
                {[
                  "All",
                  "Outstanding",
                  "Paid",
                  "Partial",
                  "Overdue",
                  "Unpaid",
                ].map((v) => (
                  <option key={v} value={v}>
                    {v === "All"
                      ? "All bills (including paid)"
                      : rentStatusLabel(v)}
                  </option>
                ))}
              </select>
              {!staff && (
                <Button variant="outline" onClick={() => setBilling(true)}>
                  <CalendarDays size={15} /> Create rent bills
                </Button>
              )}
            </>
          )}
        </div>
        <div className="table-wrap">
          {isExpense ? (
            <table>
              <thead>
                <tr>
                  {["Expense", "Category", "Date", "Paid to", "Amount", ""].map(
                    (h, i) => (
                      <th key={i}>{h}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {expenses
                  .filter((e) =>
                    e.title.toLowerCase().includes(q.toLowerCase()),
                  )
                  .map((e) => (
                    <tr key={e.id}>
                      <td data-label="Expense">
                        <span className="record-identity">
                          <strong>{e.title}</strong>
                          {e.recurring && (
                            <small className="muted">Repeat expense</small>
                          )}
                        </span>
                      </td>
                      <td data-label="Category">
                        <Badge>{e.category}</Badge>
                      </td>
                      <td data-label="Date">{displayDate(e.date)}</td>
                      <td data-label="Paid to">{e.vendor || "—"}</td>
                      <td data-label="Amount" className="money">
                        {rupees(e.amount)}
                      </td>
                      <td data-label="">
                        <Button
                          variant="ghost"
                          onClick={() => open({ kind: "expense", id: e.id })}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : tab === "Rent dues" ? (
            <table>
              <thead>
                <tr>
                  {[
                    "Tenant / Bed",
                    "Month",
                    "Due date",
                    "Rent charged",
                    "Paid",
                    "Left to pay",
                    "Status",
                    "",
                  ].map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice((page - 1) * 12, page * 12).map((i) => {
                  const advances =
                    balance(s, i) > 0
                      ? s.payments.filter(
                          (payment) =>
                            payment.tenantId === i.tenantId &&
                            paymentUnallocated(s, payment.id) > 0,
                        )
                      : [];
                  const advance = advances[0];
                  const availableAdvance = advances.reduce(
                    (total, payment) =>
                      total + paymentUnallocated(s, payment.id),
                    0,
                  );
                  return (
                    <tr key={i.id}>
                      <td data-label="Tenant / Bed">
                        <span className="record-identity">
                          <strong>
                            {s.tenants
                              .find((t) => t.id === i.tenantId)
                              ?.name.replace(" (Demo)", "")}
                          </strong>
                          <small className="muted">
                            Bed{" "}
                            {
                              s.beds.find(
                                (b) =>
                                  b.id ===
                                  s.occupancies.find(
                                    (o) => o.id === i.occupancyId,
                                  )?.bedId,
                              )?.label
                            }
                          </small>
                          {advance && (
                            <small className="muted">
                              {rupees(availableAdvance)} advance available
                            </small>
                          )}
                        </span>
                      </td>
                      <td data-label="Month">{displayMonth(i.month)}</td>
                      <td data-label="Due date">{displayDate(i.due)}</td>
                      <td data-label="Rent charged">{rupees(i.amount)}</td>
                      <td data-label="Paid">{rupees(invoicePaid(s, i.id))}</td>
                      <td data-label="Left to pay" className="money">
                        {rupees(balance(s, i))}
                      </td>
                      <td data-label="Status">
                        <Badge status={invoiceStatus(s, i)}>
                          {rentStatusLabel(invoiceStatus(s, i))}
                        </Badge>
                      </td>
                      <td data-label="">
                        {balance(s, i) > 0 && (
                          <>
                            {advance && (
                              <Button
                                variant="outline"
                                onClick={() =>
                                  open({
                                    kind: "allocate",
                                    id: advance.id,
                                    invoiceId: i.id,
                                  })
                                }
                              >
                                Use advance
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              onClick={() =>
                                open({ kind: "payment", id: i.id })
                              }
                            >
                              Collect
                            </Button>
                            <WhatsAppReminder
                              tenantId={i.tenantId}
                              invoiceId={i.id}
                              label="WhatsApp"
                              className="reminder-inline"
                            />
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : tab === "Deposits" ? (
            <table>
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Transaction</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {s.deposits
                  .filter((d) =>
                    s.tenants
                      .find((t) => t.id === d.tenantId)
                      ?.name.toLowerCase()
                      .includes(q.toLowerCase()),
                  )
                  .slice((page - 1) * 12, page * 12)
                  .map((d) => (
                    <tr key={d.id}>
                      <td data-label="Tenant">
                        <button
                          className="text-link"
                          onClick={() =>
                            open({ kind: "deposit", id: d.tenantId })
                          }
                        >
                          {s.tenants.find((t) => t.id === d.tenantId)?.name}
                        </button>
                      </td>
                      <td data-label="Transaction">
                        <Badge
                          status={d.type === "Collected" ? "Paid" : "Partial"}
                        >
                          {depositActionLabel(d.type)}
                        </Badge>
                      </td>
                      <td data-label="Amount">{rupees(d.amount)}</td>
                      <td data-label="Date">{displayDate(d.date)}</td>
                      <td data-label="Notes">{d.notes || "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Received</th>
                  <th>Not used for rent</th>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {s.payments
                  .filter(
                    (p) =>
                      p.date.startsWith(month) &&
                      s.tenants
                        .find((t) => t.id === p.tenantId)
                        ?.name.toLowerCase()
                        .includes(q.toLowerCase()) &&
                      (tab !== "Advances" ||
                        p.amount >
                          s.allocations
                            .filter((a) => a.paymentId === p.id)
                            .reduce((v, a) => v + a.amount, 0)),
                  )
                  .slice((page - 1) * 12, page * 12)
                  .map((p) => {
                    const left =
                      p.amount -
                      s.allocations
                        .filter((a) => a.paymentId === p.id)
                        .reduce((v, a) => v + a.amount, 0);
                    return (
                      <tr key={p.id}>
                        <td data-label="Tenant">
                          {s.tenants
                            .find((t) => t.id === p.tenantId)
                            ?.name.replace(" (Demo)", "")}
                        </td>
                        <td data-label="Received">{rupees(p.amount)}</td>
                        <td data-label="Not used for rent">{rupees(left)}</td>
                        <td data-label="Date">{displayDate(p.date)}</td>
                        <td data-label="Method">{p.method}</td>
                        <td data-label="">
                          <div className="button-row compact-actions">
                            <Button
                              variant="ghost"
                              onClick={() => receipt(s, p)}
                            >
                              <Download size={14} /> PDF
                            </Button>
                            <Button
                              variant="outline"
                              disabled={preparingShare === p.id}
                              onClick={() => void prepareReceiptShare(p.id)}
                            >
                              <Send size={14} />{" "}
                              {preparingShare === p.id
                                ? "Preparing PDF…"
                                : "Share receipt PDF"}
                            </Button>
                          </div>
                          {left > 0 && (
                            <Button
                              onClick={() =>
                                open({ kind: "allocate", id: p.id })
                              }
                            >
                              Use for rent
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
        {!isExpense && tab === "Rent dues" && !rows.length && (
          <Empty
            title={
              filter === "Outstanding"
                ? "No rent due this month"
                : "No rent bills to show"
            }
            description={
              filter === "Outstanding"
                ? "All bills are paid, or no bills have been created."
                : "Choose another month or create rent bills."
            }
          />
        )}
        {!isExpense && (
          <div className="pagination">
            <span>Page {page} · 12 records per page</span>
            <Button
              variant="outline"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={
                page * 12 >=
                (tab === "Rent dues"
                  ? rows.length
                  : tab === "Deposits"
                    ? s.deposits.filter((d) =>
                        s.tenants
                          .find((t) => t.id === d.tenantId)
                          ?.name.toLowerCase()
                          .includes(q.toLowerCase()),
                      ).length
                    : s.payments.filter(
                        (p) =>
                          p.date.startsWith(month) &&
                          s.tenants
                            .find((t) => t.id === p.tenantId)
                            ?.name.toLowerCase()
                            .includes(q.toLowerCase()) &&
                          (tab !== "Advances" ||
                            p.amount >
                              s.allocations
                                .filter((a) => a.paymentId === p.id)
                                .reduce((v, a) => v + a.amount, 0)),
                      ).length)
              }
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </section>
      <p className="local-note">
        Deposits and advance money are kept separate from rent paid.
      </p>
      {billing && !staff && (
        <Modal
          title={`Create rent bills for ${displayMonth(month)}?`}
          onClose={() => setBilling(false)}
        >
          <div className="dialog-body">
            <p>
              This creates a rent bill for each resident who stayed during this
              month. Bills already made will stay the same.
            </p>
            <Field label="How rent is calculated">
              <p>
                {s.settings[0].prorate
                  ? "Charge only for the days stayed"
                  : "Charge a full month"}
                . Due day: {s.settings[0].dueDay}.
              </p>
            </Field>
            <p className="notice">
              If a resident changed beds, check their rent first. The app does
              not adjust an old bill automatically.
            </p>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await service.generateInvoices(month);
                  toast.success("Rent bills created");
                  setBilling(false);
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Create rent bills
            </Button>
          </div>
        </Modal>
      )}
      {receiptShare && (
        <Modal
          title="Share payment receipt"
          description={`PDF for ${receiptShare.tenantName}. Choose WhatsApp and select the right chat in your phone's share menu.`}
          onClose={() => setReceiptShare(null)}
        >
          <div className="dialog-body receipt-share-dialog">
            <p>
              <strong>{receiptShare.file.name}</strong>
            </p>
            {typeof navigator.share === "function" &&
            typeof navigator.canShare === "function" &&
            navigator.canShare({ files: [receiptShare.file] }) ? (
              <Button disabled={shareBusy} onClick={() => void shareReceipt()}>
                <Send size={16} />{" "}
                {shareBusy ? "Opening share menu…" : "Share PDF attachment"}
              </Button>
            ) : (
              <p>
                {window.isSecureContext
                  ? "Your browser cannot share PDF files directly. Download the PDF and attach it in WhatsApp."
                  : "Direct PDF sharing needs HTTPS or localhost. Download the PDF and attach it in WhatsApp from this HTTP address."}
              </p>
            )}
            {shareError && (
              <p role="alert" className="error">
                {shareError}
              </p>
            )}
            <Button
              variant="outline"
              onClick={() => {
                downloadReceiptBlob(receiptShare.file, receiptShare.paymentId);
                setReceiptDownloaded(true);
              }}
            >
              <Download size={16} /> Download PDF
            </Button>
            {receiptDownloaded &&
              validateWhatsAppNumber(receiptShare.phone) && (
                <a
                  className="btn btn-outline"
                  href={`https://wa.me/${normalizeWhatsAppNumber(receiptShare.phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open {receiptShare.tenantName}'s WhatsApp chat to attach the
                  PDF
                </a>
              )}
          </div>
        </Modal>
      )}
    </>
  );
}
