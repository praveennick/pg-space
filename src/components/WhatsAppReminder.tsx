import { useMemo, useState } from "react";
import { LoaderCircle, MessageSquareText, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, Modal } from "./ui";
import { useApp } from "../hooks/useApp";
import { service } from "../data";
import {
  REMINDER_TEMPLATE_LABELS,
  buildReminderMessage,
  buildWhatsAppLink,
  getTenantReminderContext,
  validateWhatsAppNumber,
  type ReminderTemplateName,
} from "../services/reminders";

export function WhatsAppReminder({
  tenantId,
  invoiceId,
  label = "Send reminder",
  variant = "outline",
  className,
}: {
  tenantId: string;
  invoiceId?: string;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  className?: string;
}) {
  const { s } = useApp();
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<ReminderTemplateName>("rent-due");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const context = useMemo(
    () => getTenantReminderContext(s, tenantId, invoiceId),
    [s, tenantId, invoiceId],
  );

  const handleSend = async () => {
    if (!context) {
      setError(
        "This tenant does not have any outstanding rent to remind about.",
      );
      return;
    }
    if (!context.phone || !validateWhatsAppNumber(context.phone)) {
      setError(
        "This resident needs a valid Indian mobile number before WhatsApp can be opened.",
      );
      return;
    }
    if (!message.trim()) {
      setError("Write a message before opening WhatsApp.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const url = buildWhatsAppLink({
        phone: context.phone,
        template,
        fields: context,
        customMessage: message,
      });
      window.open(url, "_blank", "noopener,noreferrer");
      await service.recordReminderOpened(
        tenantId,
        REMINDER_TEMPLATE_LABELS[template],
        context.phone,
        message,
      );
      toast.success("WhatsApp chat opened. Review and tap Send there.");
      setOpen(false);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Unable to open WhatsApp.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  if (!context) {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        className={className}
        onClick={() => {
          setTemplate(
            context.outstandingBalance > 0
              ? "rent-due"
              : context.lastPaymentAmount != null
                ? "payment-confirmation"
                : "welcome-message",
          );
          setMessage(
            buildReminderMessage(
              context.outstandingBalance > 0
                ? "rent-due"
                : context.lastPaymentAmount != null
                  ? "payment-confirmation"
                  : "welcome-message",
              context,
            ),
          );
          setError("");
          setOpen(true);
        }}
        aria-label={`Send reminder to ${context.tenantName}`}
      >
        <MessageSquareText size={15} /> {label}
      </Button>
      {open && (
        <Modal
          title="Reminder preview"
          description="Review the personalized message before opening WhatsApp."
          className="reminder-dialog"
          onClose={() => setOpen(false)}
        >
          <div className="reminder-preview">
            <div className="reminder-panel">
              <div className="reminder-controls">
                <label>
                  Template
                  <select
                    value={template}
                    onChange={(event) => {
                      const next = event.target.value as ReminderTemplateName;
                      setTemplate(next);
                      setMessage(buildReminderMessage(next, context));
                    }}
                  >
                    {Object.entries(REMINDER_TEMPLATE_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
              <div className="reminder-summary">
                <span>
                  <Sparkles size={14} /> {context.tenantName}
                </span>
                <span>{context.roomNumber}</span>
                <span>{context.phone}</span>
              </div>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="reminder-message"
                aria-label="WhatsApp reminder message"
              />
            </div>
            {error && <p className="reminder-error">{error}</p>}
            <div className="button-row reminder-actions-row">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={busy}>
                {busy ? (
                  <>
                    <LoaderCircle size={15} className="spinner" /> Opening…
                  </>
                ) : (
                  <>
                    <Send size={15} /> Open WhatsApp
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
