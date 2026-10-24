import { useState, useRef, type FormEvent } from "react";
import {
  Download,
  Upload,
  RotateCcw,
  Save,
  Database,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../hooks/useApp";
import { service, store } from "../data";
import { demoData } from "../data/seed";
import { firebaseMode } from "../data/firebase";
import { validateBackup } from "../services/application";
import { download } from "../services/export";
import { paise, type Snapshot } from "../domain/models";
import { Button, Field, Modal, SectionTitle } from "../components/ui";
export default function Settings() {
  const { s } = useApp(),
    settings = s.settings[0],
    [busy, setBusy] = useState(false),
    [reset, setReset] = useState(false),
    [backup, setBackup] = useState<Snapshot | null>(null),
    file = useRef<HTMLInputElement>(null);
  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      str = (k: string) => String(f.get(k) || "");
    setBusy(true);
    try {
      await service.settings({
        ...settings,
        name: str("name"),
        address: str("address"),
        phone: str("phone"),
        email: str("email"),
        floors: Number(str("floors")),
        maxCapacity: Number(str("maxCapacity")),
        defaultRent: paise(str("defaultRent")),
        defaultDeposit: paise(str("defaultDeposit")),
        dueDay: Number(str("dueDay")),
        graceDays: Number(str("graceDays")),
        receiptPrefix: str("receiptPrefix"),
        prorate: f.has("prorate"),
        notifications: f.has("notifications"),
        reducedMotion: f.has("reducedMotion"),
      });
      toast.success("Settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR PG DETAILS</div>
          <h1>Settings</h1>
          <p>Update your PG details and rent rules.</p>
        </div>
      </div>
      <form onSubmit={save} className="settings-grid">
        <section className="panel">
          <SectionTitle
            title="Property details"
            sub="Name, address, and contact details."
          />
          <div className="form-grid">
            {[
              ["name", "PG name", settings.name],
              ["phone", "Contact number", settings.phone],
              ["email", "Email", settings.email],
              ["address", "Address", settings.address],
            ].map(([key, label, value]) => (
              <Field key={key} label={label}>
                <input
                  name={key}
                  defaultValue={value}
                  required={key === "name"}
                  type={key === "email" ? "email" : "text"}
                />
              </Field>
            ))}
            <Field label="Number of floors">
              <input
                name="floors"
                type="number"
                min="1"
                max="50"
                defaultValue={settings.floors}
                required
              />
            </Field>
            <Field label="Currency and local time">
              <input readOnly value="INR · Asia/Kolkata" />
            </Field>
          </div>
          <SectionTitle title="Room defaults" />
          <div className="form-grid">
            <Field label="Default rent per bed (₹)">
              <input
                name="defaultRent"
                type="number"
                min="0"
                step="0.01"
                defaultValue={settings.defaultRent / 100}
                required
              />
            </Field>
            <Field label="Default security deposit (₹)">
              <input
                name="defaultDeposit"
                type="number"
                min="0"
                step="0.01"
                defaultValue={settings.defaultDeposit / 100}
                required
              />
            </Field>
            <Field label="Most beds allowed in a room">
              <input
                name="maxCapacity"
                type="number"
                min="1"
                max="26"
                defaultValue={settings.maxCapacity}
                required
              />
            </Field>
            <Field label="Bed naming">
              <input value="Room number + A–Z" readOnly />
            </Field>
          </div>
        </section>
        <section className="panel">
          <SectionTitle
            title="Rent settings"
            sub="These settings are used for new rent bills."
          />
          <div className="form-grid">
            <Field label="Monthly due day">
              <input
                name="dueDay"
                type="number"
                min="1"
                max="28"
                defaultValue={settings.dueDay}
                required
              />
            </Field>
            <Field label="Letters before receipt number">
              <input
                name="receiptPrefix"
                defaultValue={settings.receiptPrefix}
                required
              />
            </Field>
            <Field label="Extra days before a rent reminder">
              <input
                name="graceDays"
                type="number"
                min="0"
                max="30"
                defaultValue={settings.graceDays}
              />
            </Field>
          </div>
          <label className="check-label">
            <input
              type="checkbox"
              name="prorate"
              defaultChecked={settings.prorate}
            />{" "}
            Charge rent only for the days stayed
          </label>
          <p className="muted">
            Old rent bills will not change. The app does not add late fees.
          </p>
          <SectionTitle title="App settings" />
          <label className="check-label">
            <input
              type="checkbox"
              name="notifications"
              defaultChecked={settings.notifications}
            />{" "}
            Show updates about this PG
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              name="reducedMotion"
              defaultChecked={settings.reducedMotion}
            />{" "}
            Reduce animations
          </label>
          <p className="muted">
            Choose Light, Dark, or System from the theme menu in the header.
          </p>
          <Button disabled={busy} type="submit">
            <Save size={16} /> Save settings
          </Button>
        </section>
      </form>
      <section className="panel data-panel">
        <SectionTitle
          title={
            firebaseMode
              ? "Cloud data and backups"
              : "Data saved on this device"
          }
          sub={
            firebaseMode
              ? "Records sync through your Firebase account."
              : "This app saves your data in this browser."
          }
          action={<Database className="accent" size={24} />}
        />
        <p>
          {firebaseMode
            ? "Sign in with the same account on another device to see these records. Keep a downloaded backup before importing another one. Resident photos are unavailable in Firebase mode."
            : "Data saved here does not appear on your other devices. Clearing this browser can delete it. Save a backup before clearing browser data. Use sample details only."}
        </p>
        <div className="button-row">
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              try {
                download(
                  "pg-space-backup.json",
                  JSON.stringify(await service.export(), null, 2),
                );
                toast.success("Backup exported");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <Download size={16} /> Download backup
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => file.current?.click()}
          >
            <Upload size={16} /> Import backup
          </Button>
          {!firebaseMode && (
            <Button variant="danger" onClick={() => setReset(true)}>
              <RotateCcw size={16} /> Reset demo data
            </Button>
          )}
          <input
            ref={file}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                if (f.size > 20 * 1024 * 1024)
                  throw new Error("Backup must be smaller than 20 MB.");
                setBackup(validateBackup(JSON.parse(await f.text())));
              } catch (err) {
                toast.error((err as Error).message);
              } finally {
                e.target.value = "";
              }
            }}
          />
        </div>
      </section>
      {reset && !firebaseMode && (
        <Modal
          title="Reset all demo data?"
          description="This removes current records in this browser and starts again with sample data."
          onClose={() => setReset(false)}
        >
          <div className="dialog-body">
            <p>
              Download a backup first if you want to keep these records. Only
              data in this browser will be reset.
            </p>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await store.replace(demoData());
                  setReset(false);
                  toast.success("Demo data restored");
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Yes, reset demo data
            </Button>
          </div>
        </Modal>
      )}
      {backup && (
        <Modal title="Use this backup?" onClose={() => setBackup(null)}>
          <div className="dialog-body">
            <ShieldCheck className="accent" size={32} />
            <p>
              {backup.rooms.length} rooms · {backup.tenants.length} tenants ·{" "}
              {backup.payments.length} payments · {backup.quotations.length}{" "}
              quotations
            </p>
            <p>
              This backup has been checked. Using it will replace the rooms,
              residents, payments, and quotations currently saved{" "}
              {firebaseMode ? "in Firebase" : "in this browser"}.
            </p>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const data = firebaseMode
                    ? {
                        ...backup,
                        tenants: backup.tenants.map((tenant) => {
                          const { photo: _photo, ...rest } = tenant;
                          void _photo;
                          return rest;
                        }),
                      }
                    : backup;
                  await service.import({ version: 2, data });
                  setBackup(null);
                  toast.success("Backup restored");
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Replace data with this backup
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
