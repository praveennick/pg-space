import { useEffect, useState, type FormEvent } from "react";
import { Download, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Field } from "../components/ui";
import { useData } from "../hooks/useData";
import { uid } from "../domain/models";
import { displayDate } from "../domain/dates";
import { DateInput } from "../components/DateInput";
import {
  amountInWords,
  accommodationName,
  newQuotation,
  nextQuotationNumber,
  quotationTotal,
  type Quotation,
  type QuotationItem,
} from "../domain/quotation";
import { quotationPdf } from "../services/quotationPdf";
import { saveQuotation, type SavedQuotation } from "../services/quotations";
import headerUrl from "../assets/letterhead/lucky-luxury-header.png";
import footerUrl from "../assets/letterhead/lucky-luxury-footer.png";
import "./Quotations.css";

const draftKey = "pgspace-lucky-luxury-quotation-draft-v2";
const oldDraftKey = "pgspace-lucky-luxury-quotation-draft-v1";
type Draft = { quote: Quotation; savedId: string | null };
function readDraft(): Draft {
  try {
    const raw =
      localStorage.getItem(draftKey) ?? localStorage.getItem(oldDraftKey);
    if (raw) {
      const parsed = JSON.parse(raw) as Draft | Quotation;
      const quote = "quote" in parsed ? parsed.quote : parsed;
      if (quote && Array.isArray(quote.items) && quote.items.length)
        return { quote, savedId: "savedId" in parsed ? parsed.savedId : null };
    }
  } catch {
    /* Start with a fresh form if the browser draft is damaged or unavailable. */
  }
  return { quote: newQuotation(), savedId: null };
}
const money = (value: number) => `₹${value.toLocaleString("en-IN")}`;

export default function Quotations() {
  const [initial] = useState(readDraft);
  const [quote, setQuote] = useState<Quotation>(initial.quote);
  const [savedId, setSavedId] = useState<string | null>(initial.savedId);
  const [search, setSearch] = useState("");
  const { data, isPending } = useData();
  const history = data?.quotations ?? [];
  const activeSaved =
    savedId && (isPending || history.some((saved) => saved.id === savedId));
  const displayNumber = activeSaved
    ? quote.number
    : nextQuotationNumber(history, quote.date);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({ quote, savedId }));
    } catch {
      /* Export remains available when browser storage is unavailable. */
    }
  }, [quote, savedId]);
  const change = <K extends keyof Quotation>(key: K, value: Quotation[K]) =>
    setQuote((previous) => ({ ...previous, [key]: value }));
  const changeItem = (
    id: string,
    key: keyof QuotationItem,
    value: string | number,
  ) =>
    setQuote((previous) => ({
      ...previous,
      items: previous.items.map((item) =>
        item.id === id ? { ...item, [key]: value } : item,
      ),
    }));
  const total = quotationTotal(quote.items);
  const valid = () => {
    if (
      !quote.recipient.trim() ||
      !quote.subject.trim() ||
      !quote.date ||
      !quote.items.every(
        (item) =>
          item.accommodation.trim() &&
          Number.isInteger(item.persons) &&
          item.persons > 0 &&
          Number.isFinite(item.rate) &&
          item.rate > 0,
      ) ||
      total > 99_99_99_999
    ) {
      toast.error(
        "Enter the recipient, date and all accommodation rates first.",
      );
      return false;
    }
    return true;
  };
  const persist = async () => {
    const saved = await saveQuotation(quote, savedId);
    const { id, createdAt, updatedAt, ...form } = saved;
    void createdAt;
    void updatedAt;
    setSavedId(id);
    setQuote(form);
    return saved;
  };
  const save = async () => {
    if (!valid() || isPending) return;
    setSaving(true);
    try {
      await persist();
      toast.success("Quotation saved");
    } catch (error) {
      toast.error((error as Error).message || "Could not save the quotation.");
    } finally {
      setSaving(false);
    }
  };
  const exportPdf = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid() || isPending) return;
    setExporting(true);
    try {
      const saved = await persist();
      await quotationPdf(saved);
      toast.success("Quotation saved and PDF downloaded");
    } catch (error) {
      toast.error((error as Error).message || "Could not create the PDF.");
    } finally {
      setExporting(false);
    }
  };
  const openQuotation = (saved: SavedQuotation) => {
    const { id, createdAt, updatedAt, ...form } = saved;
    void createdAt;
    void updatedAt;
    setSavedId(id);
    setQuote(form);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const filteredHistory = history
    .filter((saved) =>
      `${saved.number} ${saved.recipient}`
        .toLowerCase()
        .includes(search.toLowerCase().trim()),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LUCKY LUXURY MEN&apos;S PG</div>
          <h1>Quotations</h1>
          <p>Fill in the offer and download it on your letterhead.</p>
          <a className="quotation-history-link" href="#quotation-history">
            View quotation history ({history.length})
          </a>
        </div>
      </div>
      <div className="quotation-layout">
        <form className="quotation-form" onSubmit={exportPdf}>
          <section className="quotation-card">
            <div className="quotation-section-head">
              <h2>Quotation details</h2>
              <span>{activeSaved ? "Saved quotation" : "New quotation"}</span>
            </div>
            <div className="quotation-fields two">
              <Field
                label="Quotation number"
                hint="Added automatically when you save."
              >
                <input readOnly value={displayNumber} />
              </Field>
              <Field label="Date">
                <DateInput
                  label="Date"
                  required
                  value={quote.date}
                  onChange={(date) => change("date", date)}
                />
              </Field>
              <Field label="To / company name">
                <input
                  required
                  maxLength={120}
                  placeholder="e.g. VINTON Engineering"
                  value={quote.recipient}
                  onChange={(e) => change("recipient", e.target.value)}
                />
              </Field>
              <Field label="Recipient address">
                <textarea
                  rows={2}
                  maxLength={300}
                  placeholder="Street, city, state"
                  value={quote.address}
                  onChange={(e) => change("address", e.target.value)}
                />
              </Field>
            </div>
            <div className="quotation-fields">
              <Field label="Subject">
                <input
                  required
                  value={quote.subject}
                  onChange={(e) => change("subject", e.target.value)}
                />
              </Field>
              <Field label="Introduction">
                <textarea
                  rows={3}
                  value={quote.introduction}
                  onChange={(e) => change("introduction", e.target.value)}
                />
              </Field>
            </div>
          </section>
          <section className="quotation-card">
            <div className="quotation-section-head">
              <h2>Accommodation & rates</h2>
              <span>Monthly, per person</span>
            </div>
            <div className="quotation-items">
              {quote.items.map((item, index) => (
                <div className="quotation-item" key={item.id}>
                  <div className="quotation-item-head">
                    <strong>Item {index + 1}</strong>
                    <button
                      type="button"
                      aria-label={`Remove item ${index + 1}`}
                      disabled={quote.items.length === 1}
                      onClick={() =>
                        change(
                          "items",
                          quote.items.filter((entry) => entry.id !== item.id),
                        )
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <div className="quotation-item-fields">
                    <Field label="Accommodation">
                      <input
                        required
                        maxLength={120}
                        placeholder="e.g. 4 or 4 Sharing"
                        value={item.accommodation}
                        onChange={(e) =>
                          changeItem(item.id, "accommodation", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Persons / slots">
                      <input
                        required
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="10000"
                        step="1"
                        value={item.persons || ""}
                        onChange={(e) =>
                          changeItem(item.id, "persons", Number(e.target.value))
                        }
                      />
                    </Field>
                    <Field label="Rate / person / month (₹)">
                      <input
                        required
                        type="number"
                        inputMode="decimal"
                        min="1"
                        max="999999999"
                        step="1"
                        value={item.rate || ""}
                        onChange={(e) =>
                          changeItem(item.id, "rate", Number(e.target.value))
                        }
                      />
                    </Field>
                  </div>
                  <div className="quotation-item-total">
                    Amount / month{" "}
                    <strong>{money(item.persons * item.rate)}</strong>
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                change("items", [
                  ...quote.items,
                  {
                    id: uid(),
                    accommodation: "",
                    persons: 1,
                    rate: 0,
                  },
                ])
              }
            >
              <Plus size={17} /> Add accommodation
            </Button>
            <div className="quotation-total">
              Total monthly amount <strong>{money(total)}</strong>
            </div>
            <p className="quotation-words">{amountInWords(total)} per month</p>
          </section>
          <section className="quotation-card">
            <div className="quotation-section-head">
              <h2>Notes & sign-off</h2>
            </div>
            <div className="quotation-fields">
              <Field
                label="Notes / inclusions"
                hint="Write one point per line."
              >
                <textarea
                  rows={6}
                  value={quote.notes}
                  onChange={(e) => change("notes", e.target.value)}
                />
              </Field>
              <Field label="Closing line">
                <input
                  value={quote.closing}
                  onChange={(e) => change("closing", e.target.value)}
                />
              </Field>
              <Field label="Signatory">
                <input
                  value={quote.signatory}
                  onChange={(e) => change("signatory", e.target.value)}
                />
              </Field>
            </div>
          </section>
          <div className="quotation-actions">
            <Button type="submit" disabled={exporting || saving || isPending}>
              <Download size={17} />{" "}
              {exporting ? "Creating PDF…" : "Download PDF"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={exporting || saving || isPending}
              onClick={save}
            >
              <Save size={17} /> {saving ? "Saving…" : "Save quotation"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSavedId(null);
                setQuote(
                  newQuotation(
                    nextQuotationNumber([
                      ...history,
                      ...(activeSaved ? [{ number: quote.number }] : []),
                    ]),
                  ),
                );
              }}
            >
              <RotateCcw size={16} /> New quotation
            </Button>
          </div>
        </form>
        <aside className="quotation-preview" aria-label="Quotation summary">
          <h2>Letterhead preview</h2>
          <div className="quotation-paper">
            <img src={headerUrl} alt="Lucky Luxury Men's PG letterhead" />
            <div className="quotation-paper-body">
              <h3>QUOTATION</h3>
              <p>
                <strong>To:</strong> {quote.recipient || "Recipient name"}
              </p>
              {quote.address && <p>{quote.address}</p>}
              <p>
                <strong>No:</strong> {displayNumber}
              </p>
              <p>
                <strong>Subject:</strong> {quote.subject}
              </p>
              <div className="quotation-preview-items">
                {quote.items.map((item) => (
                  <div key={item.id}>
                    <span>
                      {accommodationName(item.accommodation) || "Accommodation"}{" "}
                      × {item.persons}
                    </span>
                    <strong>{money(item.persons * item.rate)}</strong>
                  </div>
                ))}
              </div>
              <div className="quotation-preview-total">
                <span>Total / month</span>
                <strong>{money(total)}</strong>
              </div>
              <small>
                The downloaded PDF includes your full introduction, notes and
                sign-off.
              </small>
            </div>
            <img src={footerUrl} alt="" />
          </div>
        </aside>
      </div>
      <section
        id="quotation-history"
        className="quotation-card quotation-history"
        aria-label="Quotation history"
      >
        <div className="quotation-section-head">
          <div>
            <h2>Quotation history</h2>
            <p>
              Open a saved quotation to change it or download it again. Saved in
              this browser.
            </p>
          </div>
          <span>{history.length} saved</span>
        </div>
        {history.length > 0 && (
          <Field label="Find a quotation">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by number or recipient"
            />
          </Field>
        )}
        {filteredHistory.length ? (
          <div className="quotation-history-list">
            {filteredHistory.map((saved) => (
              <div className="quotation-history-row" key={saved.id}>
                <div className="quotation-history-info">
                  <strong>{saved.recipient}</strong>
                  <span>
                    {saved.number} · {displayDate(saved.date)}
                  </span>
                  <span>{money(quotationTotal(saved.items))} per month</span>
                </div>
                <div className="quotation-history-actions">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openQuotation(saved)}
                  >
                    Open
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await quotationPdf(saved);
                      } catch (error) {
                        toast.error(
                          (error as Error).message ||
                            "Could not create the PDF.",
                        );
                      }
                    }}
                  >
                    <Download size={16} /> PDF
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="quotation-history-empty">
            {history.length
              ? "No matching quotations."
              : "No saved quotations yet."}
          </p>
        )}
      </section>
    </>
  );
}
