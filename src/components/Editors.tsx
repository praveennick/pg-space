import { useState, type FormEvent, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  BedDouble,
  Check,
  ArrowRight,
  ArrowLeft,
  UserPlus,
  Wrench,
  CalendarDays,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../hooks/useApp";
import { service } from "../data";
import {
  stamp,
  today,
  paise,
  rupees,
  uid,
  type Room,
  type Tenant,
} from "../domain/models";
import {
  activeBeds,
  bedStatus,
  balance,
  paymentUnallocated,
  depositHeld,
  activeReservation,
} from "../domain/calculations";
import { Button, Modal, Field, Badge } from "./ui";
import { depositActionLabel } from "./labels";
import { TenantAvatar, TenantPhotoPicker } from "./TenantPhoto";
import { fileStorage } from "../services/fileStorage";
import { firebaseMode } from "../data/firebase";
import { DateInput } from "./DateInput";
import { displayDate, displayMonth } from "../domain/dates";
export type EditorState = {
  kind: string;
  id?: string;
  invoiceId?: string;
  bedId?: string;
  reservationId?: string;
};
const facilities = [
  "AC",
  "Attached Bathroom",
  "Balcony",
  "Wi-Fi",
  "Wardrobe",
  "Study Table",
  "Fan",
  "Geyser",
  "TV",
  "Furnished",
  "Semi-furnished",
];
const methods = ["Cash", "UPI", "Bank Transfer", "Card", "Other"];
const expenseCategories = [
  "Electricity",
  "Water",
  "Internet",
  "Groceries",
  "Salaries",
  "Cleaning",
  "Maintenance",
  "Repairs",
  "Rent / Lease",
  "Gas",
  "Furniture",
  "Other",
];
export function Editors({
  editor,
  onClose,
}: {
  editor: EditorState;
  onClose: () => void;
}) {
  if (editor.kind === "room")
    return <RoomEditor id={editor.id} onClose={onClose} />;
  if (editor.kind === "tenant")
    return <TenantEditor editor={editor} onClose={onClose} />;
  if (editor.kind === "bed")
    return <BedDetails id={editor.id!} onClose={onClose} />;
  return <TransactionEditor editor={editor} onClose={onClose} />;
}
function RoomEditor({ id, onClose }: { id?: string; onClose: () => void }) {
  const { s } = useApp(),
    room = s.rooms.find((r) => r.id === id),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(
      room?.facilities || ["Wi-Fi", "Wardrobe", "Fan"],
    ),
    [confirm, setConfirm] = useState<Room | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      number: room?.number || "",
      floor: room?.floor || 0,
      capacity: room?.capacity || 2,
      rent: (room?.rent ?? s.settings[0].defaultRent) / 100,
      deposit: (room?.deposit ?? s.settings[0].defaultDeposit) / 100,
      description: room?.description || "",
    },
  });
  const capacity = useWatch({ control, name: "capacity" }),
    number = useWatch({ control, name: "number" });
  const save = async (input: Room) => {
    setBusy(true);
    try {
      await service.saveRoom(input);
      toast.success(room ? "Room updated" : "Room created with its beds");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={room ? `Edit room ${room.number}` : "Add a room"}
      description="Enter the room details and number of beds."
      onClose={onClose}
      wide
    >
      <form
        onSubmit={handleSubmit((v) => {
          try {
            const input = {
              ...(room || stamp()),
              ...v,
              floor: Number(v.floor),
              capacity: Number(v.capacity),
              rent: paise(v.rent),
              deposit: paise(v.deposit),
              facilities: selected,
              archived: false,
            };
            if (room && input.capacity < room.capacity) setConfirm(input);
            else void save(input);
          } catch (e) {
            toast.error((e as Error).message);
          }
        })}
      >
        <div className="dialog-body">
          <div className="form-section-title">
            <span>01</span>
            <h3>Room details</h3>
          </div>
          <div className="form-grid">
            <Field label="Room number *">
              <input
                placeholder="e.g. 401"
                {...register("number", { required: true, maxLength: 20 })}
              />
              {errors.number && (
                <small className="error">Enter a room number.</small>
              )}
            </Field>
            <Field label="Floor">
              <select {...register("floor")}>
                {Array.from({ length: s.settings[0].floors }, (_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? "Ground floor" : `Floor ${i}`}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Sharing type">
              <select
                value={Number(capacity) <= 6 ? capacity : "custom"}
                onChange={(e) => {
                  if (e.target.value === "custom") {
                    setValue("capacity", 7);
                  } else {
                    setValue("capacity", Number(e.target.value));
                  }
                }}
              >
                <option value="custom">Custom sharing</option>
                {["Single", "Double", "Triple", "Four", "Five", "Six"].map(
                  (v, i) => (
                    <option key={v} value={i + 1}>
                      {v} sharing
                    </option>
                  ),
                )}
              </select>
            </Field>
            <Field
              label="Number of beds *"
              hint={`Choose 1 to ${s.settings[0].maxCapacity} beds. Existing bed names stay the same.`}
            >
              <input
                id="capacity"
                type="number"
                min="1"
                max={s.settings[0].maxCapacity}
                {...register("capacity", {
                  required: true,
                  valueAsNumber: true,
                  min: 1,
                  max: s.settings[0].maxCapacity,
                })}
              />
            </Field>
          </div>
          <div className="bed-preview">
            {Array.from(
              { length: Math.min(Number(capacity) || 1, 26) },
              (_, i) => (
                <span key={i}>
                  <BedDouble size={23} />
                  <small>
                    {number || "Room"}-{String.fromCharCode(65 + i)}
                  </small>
                </span>
              ),
            )}
          </div>
          <div className="form-section-title">
            <span>02</span>
            <h3>Rent and deposit</h3>
          </div>
          <div className="form-grid">
            <Field label="Monthly rent per bed (₹) *">
              <input
                type="number"
                min="0"
                step="0.01"
                {...register("rent", { required: true })}
              />
            </Field>
            <Field label="Security deposit (₹) *">
              <input
                type="number"
                min="0"
                step="0.01"
                {...register("deposit", { required: true })}
              />
            </Field>
          </div>
          <div className="form-section-title">
            <span>03</span>
            <h3>Facilities</h3>
          </div>
          <div className="facility-toggles">
            {facilities.map((f) => (
              <button
                type="button"
                key={f}
                aria-pressed={selected.includes(f)}
                className={selected.includes(f) ? "selected" : ""}
                onClick={() =>
                  setSelected(
                    selected.includes(f)
                      ? selected.filter((v) => v !== f)
                      : [...selected, f],
                  )
                }
              >
                {selected.includes(f) && <Check size={14} />} {f}
              </button>
            ))}
          </div>
          <Field label="Description">
            <textarea
              {...register("description")}
              placeholder="Add any useful room details"
            />
          </Field>
        </div>
        <div className="dialog-footer">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} type="submit">
            {busy ? "Saving…" : room ? "Save changes" : "Create room & beds"}{" "}
            <ArrowRight size={16} />
          </Button>
        </div>
      </form>
      {confirm && (
        <Modal title="Remove empty beds?" onClose={() => setConfirm(null)}>
          <div className="dialog-body">
            <p>
              {s.beds
                .filter(
                  (b) =>
                    b.roomId === id &&
                    !b.retired &&
                    b.position >= confirm.capacity,
                )
                .map((b) => `${b.label} (${bedStatus(s, b)})`)
                .join(", ")}
            </p>
            <p>
              Only free beds can be removed. Old stays, rent bills, and payments
              will remain saved.
            </p>
            <Button disabled={busy} onClick={() => save(confirm)}>
              Remove empty beds
            </Button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
function TenantEditor({
  editor,
  onClose,
}: {
  editor: EditorState;
  onClose: () => void;
}) {
  const { s } = useApp(),
    existing = s.tenants.find((t) => t.id === editor.id),
    reservation = s.reservations.find((r) => r.id === editor.reservationId),
    [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [photo, setPhoto] = useState<Blob | null>(null),
    [removePhoto, setRemovePhoto] = useState(false),
    [bedId, setBed] = useState(editor.bedId || reservation?.bedId || ""),
    [floor, setFloor] = useState("all"),
    [roomId, setRoom] = useState("all");
  const initial = s.rooms.find(
    (r) => r.id === s.beds.find((b) => b.id === bedId)?.roomId,
  );
  const [rent, setRent] = useState(
      (initial?.rent ?? s.settings[0].defaultRent) / 100,
    ),
    [deposit, setDeposit] = useState(
      (initial?.deposit ?? s.settings[0].defaultDeposit) / 100,
    );
  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    control,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: existing?.name || reservation?.name || "",
      phone: existing?.phone || reservation?.phone || "",
      email: existing?.email || "",
      address: existing?.address || "",
      emergency: existing?.emergency || "",
      occupation: existing?.occupation || "",
      idMetadata: existing?.idMetadata || "",
      verificationStatus: existing?.verification?.status || "Not checked",
      verificationDate: existing?.verification?.date || "",
      verificationMethod: existing?.verification?.method || "",
      verifyingStaff: existing?.verification?.staff || "",
      aadhaarConsent: existing?.verification?.consent || false,
      notes: existing?.notes || "",
      start: today(),
      dueDay: s.settings[0].dueDay,
      expectedCheckout: "",
    },
  });
  const verificationStatus = useWatch({ control, name: "verificationStatus" });
  const verificationMethod = useWatch({ control, name: "verificationMethod" });
  const available = activeBeds(s).filter(
    (b) =>
      (bedStatus(s, b) === "Available" || b.id === reservation?.bedId) &&
      (floor === "all" ||
        s.rooms.find((r) => r.id === b.roomId)?.floor === Number(floor)) &&
      (roomId === "all" || b.roomId === roomId),
  );
  const save = handleSubmit(async (v) => {
    if (
      v.verificationStatus === "Verified" &&
      (!v.verificationDate || !v.verificationMethod || !v.verifyingStaff.trim())
    ) {
      toast.error(
        "Add the date, ID checked, and staff name before marking this resident verified.",
      );
      return;
    }
    if (
      v.verificationStatus === "Verified" &&
      v.verificationMethod === "Aadhaar checked in person" &&
      !v.aadhaarConsent
    ) {
      toast.error(
        "Record voluntary consent before marking this Aadhaar check verified.",
      );
      return;
    }
    setBusy(true);
    let newPhotoId: string | null = null;
    try {
      const t: Tenant = {
        ...(existing || stamp()),
        name: v.name,
        phone: v.phone,
        email: v.email,
        address: v.address,
        emergency: v.emergency,
        occupation: v.occupation,
        idMetadata: v.idMetadata,
        verification: {
          status: v.verificationStatus as NonNullable<
            Tenant["verification"]
          >["status"],
          date: v.verificationDate,
          method: v.verificationMethod as NonNullable<
            Tenant["verification"]
          >["method"],
          staff: v.verifyingStaff.trim(),
          consent:
            v.verificationMethod === "Aadhaar checked in person"
              ? v.aadhaarConsent
              : false,
        },
        notes: v.notes,
      };
      if (!firebaseMode && photo) {
        t.photo = await fileStorage.saveTenantPhoto(t.id, photo);
        if (!existing) newPhotoId = t.id;
      }
      if (firebaseMode || removePhoto) delete t.photo;
      if (!firebaseMode && removePhoto)
        await fileStorage.deleteTenantPhoto(t.id);
      if (existing) await service.editTenant(t);
      else
        await service.checkIn(
          t,
          {
            bedId,
            start: v.start,
            rent: paise(rent),
            deposit: paise(deposit),
            dueDay: Number(v.dueDay),
            expectedCheckout: v.expectedCheckout,
          },
          reservation?.id,
        );
      toast.success(
        existing ? "Resident updated" : "Resident checked in. Invoice created.",
      );
      onClose();
    } catch (e) {
      if (newPhotoId)
        await fileStorage.deleteTenantPhoto(newPhotoId).catch(() => undefined);
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  });
  const next = async () => {
    if (step === 0 && !(await trigger(["name", "phone", "email"]))) return;
    if (step === 1 && !bedId) {
      toast.error("Select an available bed");
      return;
    }
    if (step === 2 && !(await trigger(["start", "dueDay"]))) return;
    setStep(step + 1);
  };
  return (
    <Modal
      wide
      title={existing ? "Edit resident" : "Add a resident"}
      description={
        existing
          ? "Update their details. Old stay and payment records will remain saved."
          : "Enter their details, choose a bed, and set the rent."
      }
      onClose={onClose}
    >
      <form onSubmit={save}>
        {!existing && (
          <div className="wizard-steps">
            {["Person", "Bed", "Rent", "Check details"].map((v, i) => (
              <div key={v} className={i <= step ? "active" : ""}>
                <span>{i < step ? <Check size={13} /> : i + 1}</span>
                <small>{v}</small>
              </div>
            ))}
          </div>
        )}
        <div className="dialog-body">
          {(existing || step === 0) && (
            <>
              <h3>Resident details</h3>
              {!firebaseMode && <TenantPhotoPicker
                tenant={existing}
                photo={photo}
                removed={removePhoto}
                onChange={(next) => {
                  setPhoto(next);
                  setRemovePhoto(false);
                }}
                onRemove={() => {
                  setPhoto(null);
                  setRemovePhoto(true);
                }}
              />}
              <div className="form-grid">
                <Field label="Full name *">
                  <input
                    {...register("name", { required: true, minLength: 2 })}
                  />
                  {errors.name && (
                    <small className="error">
                      At least two characters required.
                    </small>
                  )}
                </Field>
                <Field label="Phone *">
                  <input
                    {...register("phone", { required: true, minLength: 5 })}
                  />
                  {errors.phone && (
                    <small className="error">Enter a phone number.</small>
                  )}
                </Field>
                <Field label="Email">
                  <input type="email" {...register("email")} />
                </Field>
                <Field label="Occupation">
                  <input {...register("occupation")} />
                </Field>
                <Field label="Emergency contact">
                  <input {...register("emergency")} />
                </Field>
              </div>
              <h3>Identity verification</h3>
              <p className="muted">
                Record what staff checked. Do not enter ID numbers or upload
                identity documents here.
              </p>
              <div className="form-grid">
                <Field label="Verification status">
                  <select {...register("verificationStatus")}>
                    <option value="Not checked">Not checked</option>
                    <option value="Pending">Pending</option>
                    <option value="Verified">Verified</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </Field>
                <Field label="ID checked">
                  <select {...register("verificationMethod")}>
                    <option value="">Choose an ID type</option>
                    <option value="Driving licence">Driving licence</option>
                    <option value="Voter ID">Voter ID</option>
                    <option value="Passport">Passport</option>
                    <option value="Aadhaar checked in person">
                      Aadhaar checked in person
                    </option>
                    <option value="Other ID">Other ID</option>
                  </select>
                </Field>
                <Field label="Date checked">
                  <Controller
                    control={control}
                    name="verificationDate"
                    render={({ field }) => (
                      <DateInput
                        label="Date checked"
                        value={field.value}
                        onChange={field.onChange}
                        max={today()}
                      />
                    )}
                  />
                </Field>
                <Field label="Checked by">
                  <input
                    maxLength={100}
                    placeholder="Staff member's name"
                    {...register("verifyingStaff")}
                  />
                </Field>
              </div>
              {verificationMethod === "Aadhaar checked in person" && (
                <label className="check-label">
                  <input type="checkbox" {...register("aadhaarConsent")} />
                  Resident voluntarily agreed to this in-person Aadhaar check.
                  An alternative ID was offered.
                </label>
              )}
              {verificationStatus === "Verified" && (
                <p className="notice">
                  A date, ID type and staff name are required for Verified.
                </p>
              )}
              <Field label="Address">
                <textarea {...register("address")} />
              </Field>
              <Field label="Notes">
                <textarea {...register("notes")} />
              </Field>
            </>
          )}
          {!existing && step === 1 && (
            <>
              <h3>Choose a free bed</h3>
              <div className="form-grid">
                <Field label="Floor">
                  <select
                    value={floor}
                    onChange={(e) => {
                      setFloor(e.target.value);
                      setRoom("all");
                    }}
                  >
                    <option value="all">All floors</option>
                    {Array.from({ length: s.settings[0].floors }, (_, i) => (
                      <option key={i} value={i}>
                        Floor {i}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Room">
                  <select
                    value={roomId}
                    onChange={(e) => setRoom(e.target.value)}
                  >
                    <option value="all">All rooms</option>
                    {s.rooms
                      .filter(
                        (r) =>
                          !r.archived &&
                          (floor === "all" || r.floor === Number(floor)),
                      )
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          Room {r.number}
                        </option>
                      ))}
                  </select>
                </Field>
              </div>
              <div className="allocation-grid">
                {available.map((b) => {
                  const r = s.rooms.find((r) => r.id === b.roomId)!;
                  return (
                    <button
                      type="button"
                      className={bedId === b.id ? "selected" : ""}
                      key={b.id}
                      onClick={() => {
                        setBed(b.id);
                        setRent((b.rent ?? r.rent) / 100);
                        setDeposit(r.deposit / 100);
                      }}
                    >
                      <BedDouble size={24} />
                      <strong>{b.label}</strong>
                      <small>{rupees(b.rent ?? r.rent)} / month</small>
                    </button>
                  );
                })}
              </div>
              {!available.length && (
                <p>No available beds match this selection.</p>
              )}
            </>
          )}
          {!existing && step === 2 && (
            <>
              <h3>Rent and move-in details</h3>
              <div className="form-grid">
                <Field label="Check-in date">
                  <Controller
                    control={control}
                    name="start"
                    rules={{ required: true }}
                    render={({ field }) => (
                      <DateInput
                        label="Check-in date"
                        value={field.value}
                        onChange={field.onChange}
                        max={today()}
                        required
                      />
                    )}
                  />
                </Field>
                <Field label="Expected checkout (optional)">
                  <Controller
                    control={control}
                    name="expectedCheckout"
                    render={({ field }) => (
                      <DateInput
                        label="Expected checkout"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </Field>
                <Field label="Monthly rent (₹)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={rent}
                    onChange={(e) => setRent(Number(e.target.value))}
                  />
                </Field>
                <Field label="Agreed security deposit (₹)">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={deposit}
                    onChange={(e) => setDeposit(Number(e.target.value))}
                  />
                </Field>
                <Field label="Monthly due day">
                  <input
                    type="number"
                    min="1"
                    max="28"
                    {...register("dueDay", { required: true, min: 1, max: 28 })}
                  />
                </Field>
                <Field label="Rent charged">
                  <input value="Monthly" readOnly />
                </Field>
              </div>
              <p className="notice">
                This is the deposit amount agreed with the resident. Record the
                money separately when you receive it.
              </p>
            </>
          )}
          {!existing && step === 3 && (
            <>
              <div className="review-icon">
                <Check size={28} />
              </div>
              <h3>Check these details</h3>
              <div className="review-summary">
                <div>
                  <span>Resident</span>
                  <strong>{getValues("name")}</strong>
                </div>
                <div>
                  <span>Bed</span>
                  <strong>{s.beds.find((b) => b.id === bedId)?.label}</strong>
                </div>
                <div>
                  <span>Check-in</span>
                  <strong>{getValues("start")}</strong>
                </div>
                <div>
                  <span>Monthly rent</span>
                  <strong>{rupees(Math.round(rent * 100))}</strong>
                </div>
                <div>
                  <span>Agreed deposit</span>
                  <strong>{rupees(Math.round(deposit * 100))}</strong>
                </div>
              </div>
              <p className="muted">
                Saving this will add the resident, assign the bed, and create
                their first rent bill.
              </p>
            </>
          )}
        </div>
        <div className="dialog-footer">
          {step > 0 && !existing ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft size={16} /> Back
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
          {existing || step === 3 ? (
            <Button key="confirm" type="submit" disabled={busy}>
              {busy
                ? "Saving…"
                : existing
                  ? "Save resident"
                  : "Confirm check-in"}{" "}
              <Check size={16} />
            </Button>
          ) : (
            <Button
              key="continue"
              type="button"
              onClick={(event) => {
                event.preventDefault();
                void next();
              }}
            >
              Continue <ArrowRight size={16} />
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
function BedDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const { s, open } = useApp(),
    navigate = useNavigate(),
    bed = s.beds.find((b) => b.id === id)!,
    room = s.rooms.find((r) => r.id === bed.roomId)!,
    status = bedStatus(s, bed),
    stay = s.occupancies.find((o) => o.bedId === id && !o.end),
    tenant = s.tenants.find((t) => t.id === stay?.tenantId),
    res = s.reservations.find((r) => r.bedId === id && activeReservation(r)),
    ticket = s.tickets.find(
      (t) =>
        t.bedId === id && t.block && !["Resolved", "Closed"].includes(t.status),
    ),
    [rent, setRent] = useState(bed.rent === null ? "" : String(bed.rent / 100)),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      title={`Bed ${bed.label}`}
      description={`Room ${room.number} · Floor ${room.floor} · ${room.capacity}-sharing`}
      onClose={onClose}
    >
      <div className="dialog-body">
        <div className="bed-detail-hero">
          <BedDouble size={50} />
          <Badge status={status}>{status}</Badge>
        </div>
        <div className="detail-metrics">
          <div>
            <small>Monthly rent</small>
            <strong>{rupees(stay?.rent ?? bed.rent ?? room.rent)}</strong>
          </div>
          <div>
            <small>Deposit</small>
            <strong>{rupees(room.deposit)}</strong>
          </div>
        </div>
        {tenant && (
          <>
            <div className="bed-resident-heading">
              <TenantAvatar tenant={tenant} className="large" />
              <h3>{tenant.name}</h3>
            </div>
            <p>
              {tenant.phone} · Since {displayDate(stay?.start)}
            </p>
            <p>
              Outstanding:{" "}
              <strong>
                {rupees(
                  s.invoices
                    .filter((i) => i.tenantId === tenant.id)
                    .reduce((v, i) => v + balance(s, i), 0),
                )}
              </strong>
            </p>
            <div className="button-row">
              <Button
                onClick={() => {
                  onClose();
                  navigate(`/app/tenants/${tenant.id}`);
                }}
              >
                View profile
              </Button>
              <Button
                variant="outline"
                onClick={() => open({ kind: "transfer", id: tenant.id })}
              >
                Transfer
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  open({
                    kind: "payment",
                    id: s.invoices.find(
                      (i) => i.tenantId === tenant.id && balance(s, i) > 0,
                    )?.id,
                  })
                }
              >
                Collect rent
              </Button>
              <Button
                variant="danger"
                onClick={() => open({ kind: "checkout", id: tenant.id })}
              >
                Checkout
              </Button>
            </div>
          </>
        )}
        {status === "Available" && (
          <div className="button-row">
            <Button onClick={() => open({ kind: "tenant", bedId: id })}>
              <UserPlus size={15} /> Assign tenant
            </Button>
            <Button
              variant="outline"
              onClick={() => open({ kind: "reservation", bedId: id })}
            >
              <CalendarDays size={15} /> Reserve
            </Button>
            <Button
              variant="outline"
              onClick={() => open({ kind: "ticket", bedId: id })}
            >
              <Wrench size={15} /> Block for maintenance
            </Button>
          </div>
        )}
        {res && (
          <>
            <h3>{res.name}</h3>
            <p>
              Expected {displayDate(res.checkIn)} · Expires{" "}
              {displayDate(res.expires)}
            </p>
            <Button
              onClick={() => {
                onClose();
                navigate("/app/reservations");
              }}
            >
              Manage reservation
            </Button>
          </>
        )}
        {ticket && (
          <>
            <h3>{ticket.category}</h3>
            <p>{ticket.description}</p>
            <Button
              onClick={() => {
                onClose();
                navigate("/app/maintenance");
              }}
            >
              Manage maintenance
            </Button>
          </>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await service.bedRent(id, rent === "" ? null : paise(rent));
              toast.success("Bed rent updated");
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field
            label="Individual bed rent (₹)"
            hint="Leave blank to use the room rent. Rent already agreed with residents will not change."
          >
            <input
              type="number"
              step="0.01"
              min="0"
              value={rent}
              onChange={(e) => setRent(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="outline" disabled={busy}>
            Save bed rent
          </Button>
        </form>
      </div>
    </Modal>
  );
}
function TransactionEditor({
  editor,
  onClose,
}: {
  editor: EditorState;
  onClose: () => void;
}) {
  const { s } = useApp(),
    { kind, id } = editor,
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [dates, setDates] = useState<Record<string, string>>({}),
    [key] = useState(uid),
    invoice = s.invoices.find((i) => i.id === id),
    payment = s.payments.find((p) => p.id === id),
    tenant = s.tenants.find((t) => t.id === id),
    expense = s.expenses.find((e) => e.id === id),
    initialTenantId =
      invoice?.tenantId || payment?.tenantId || tenant?.id || "",
    initialBill =
      kind === "payment" || kind === "allocate"
        ? s.invoices.find((item) => item.id === editor.invoiceId) ||
          invoice ||
          s.invoices
            .filter(
              (item) =>
                item.tenantId === initialTenantId && balance(s, item) > 0,
            )
            .sort((a, b) => a.due.localeCompare(b.due))[0]
        : undefined,
    [tenantId, setTenant] = useState(initialTenantId),
    [invoiceId, setInvoice] = useState(initialBill?.id || ""),
    [bedId, setBed] = useState(editor.bedId || ""),
    [roomId, setRoom] = useState(
      s.beds.find((b) => b.id === editor.bedId)?.roomId || "",
    ),
    [amount, setAmount] = useState(
      initialBill
        ? String(
            (kind === "allocate" && payment
              ? Math.min(
                  balance(s, initialBill),
                  paymentUnallocated(s, payment.id),
                )
              : balance(s, initialBill)) / 100,
          )
        : expense
          ? String(expense.amount / 100)
          : "",
    ),
    [depositType, setDepositType] = useState("Collected");
  const stay = s.occupancies.find((o) => o.tenantId === id && !o.end),
    held = depositHeld(s, id),
    available = activeBeds(s).filter((b) => bedStatus(s, b) === "Available"),
    titles: Record<string, string> = {
      payment: "Record a payment",
      expense: expense ? "Edit expense" : "Add an expense",
      reservation: "New reservation",
      ticket: "Report a problem",
      transfer: "Transfer resident",
      checkout: "Check out resident",
      deposit: "Deposit history",
      allocate: "Use advance for rent",
    };
  const input = (
    label: string,
    name: string,
    type = "text",
    value?: string,
    required = false,
  ) => (
    <Field label={label}>
      {type === "date" ? (
        <DateInput
          label={label}
          name={name}
          value={dates[name] ?? value ?? ""}
          onChange={(next) =>
            setDates((current) => ({ ...current, [name]: next }))
          }
          required={required}
        />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          {...(type === "number" ? { min: 0, step: ".01" } : {})}
        />
      )}
    </Field>
  );
  const select = (
    label: string,
    name: string,
    options: string[],
    value?: string,
  ) => (
    <Field label={label}>
      <select name={name} defaultValue={value}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </Field>
  );
  const bedSelect = (
    <Field label="Available bed *">
      <select
        value={bedId}
        required
        onChange={(e) => {
          setBed(e.target.value);
          setRoom(s.beds.find((b) => b.id === e.target.value)?.roomId || "");
        }}
      >
        <option value="">Choose a bed</option>
        {available
          .filter((b) => kind !== "ticket" || !roomId || b.roomId === roomId)
          .map((b) => (
            <option value={b.id} key={b.id}>
              {b.label} ·{" "}
              {rupees(b.rent ?? s.rooms.find((r) => r.id === b.roomId)!.rent)}
            </option>
          ))}
      </select>
    </Field>
  );
  const amountField = (
    <Field label="Amount (₹) *">
      <input
        name="amount"
        type="number"
        min="0.01"
        step="0.01"
        required
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
    </Field>
  );
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget),
      str = (n: string) => String(f.get(n) || "");
    try {
      if (kind === "payment")
        await service.payment(
          {
            ...stamp(),
            tenantId,
            amount: paise(amount),
            date: str("date"),
            method: str("method") as "Cash",
            reference: str("reference"),
            notes: str("notes"),
            key,
          },
          invoiceId || undefined,
        );
      if (kind === "allocate")
        await service.allocate(id!, invoiceId, paise(amount));
      if (kind === "expense")
        await service.expense({
          ...(expense || stamp()),
          title: str("title"),
          amount: paise(amount),
          category: str("category"),
          date: str("date"),
          method: str("method"),
          vendor: str("vendor"),
          notes: str("notes"),
          recurring: f.has("recurring"),
          receipt: str("receipt"),
        });
      if (kind === "reservation")
        await service.reservation({
          ...stamp(),
          name: str("name"),
          phone: str("phone"),
          bedId,
          checkIn: str("checkIn"),
          expires: str("expires"),
          amount: paise(str("booking") || "0"),
          status: str("status") as "Pending",
          notes: str("notes"),
        });
      if (kind === "ticket")
        await service.ticket({
          ...stamp(),
          roomId,
          bedId,
          category: str("category"),
          description: str("description"),
          priority: str("priority") as "Medium",
          status: "Open",
          block: f.has("block"),
          resolution: "",
        });
      if (kind === "transfer")
        await service.transfer(id!, bedId, str("date"), f.has("cleaning"));
      if (kind === "checkout")
        await service.checkout(
          id!,
          str("date"),
          f.has("cleaning"),
          str("notes"),
        );
      if (kind === "deposit") {
        const occupancy = s.occupancies.filter((o) => o.tenantId === id).at(-1);
        if (!occupancy) throw new Error("No stay found");
        await service.deposit({
          ...stamp(),
          tenantId: id!,
          occupancyId: occupancy.id,
          type: depositType as "Collected",
          amount: paise(amount),
          date: str("date"),
          notes: str("notes"),
        });
      }
      toast.success(
        firebaseMode ? "Saved to Firebase" : "Saved in this browser",
      );
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  let content: ReactNode = null;
  if (kind === "payment" || kind === "allocate")
    content = (
      <>
        <div className="form-grid">
          <Field label="Tenant *">
            <select
              required
              value={tenantId}
              disabled={kind === "allocate"}
              onChange={(e) => {
                setTenant(e.target.value);
                const oldestDue = s.invoices
                  .filter(
                    (item) =>
                      item.tenantId === e.target.value && balance(s, item) > 0,
                  )
                  .sort((a, b) => a.due.localeCompare(b.due))[0];
                setInvoice(oldestDue?.id || "");
                setAmount(oldestDue ? String(balance(s, oldestDue) / 100) : "");
              }}
            >
              <option value="">Choose a tenant</option>
              {s.tenants.map((t) => {
                const stay = s.occupancies.find(
                  (occupancy) => occupancy.tenantId === t.id && !occupancy.end,
                );
                const bed = s.beds.find((item) => item.id === stay?.bedId);
                return (
                  <option key={t.id} value={t.id}>
                    {t.name} · {bed ? `Bed ${bed.label} · ` : ""}
                    {t.phone}
                  </option>
                );
              })}
            </select>
          </Field>
          <Field label="Rent bill">
            <select
              required={kind === "allocate"}
              value={invoiceId}
              onChange={(e) => {
                setInvoice(e.target.value);
                const i = s.invoices.find((i) => i.id === e.target.value);
                if (i)
                  setAmount(
                    String(
                      (kind === "allocate" && payment
                        ? Math.min(
                            balance(s, i),
                            paymentUnallocated(s, payment.id),
                          )
                        : balance(s, i)) / 100,
                    ),
                  );
              }}
            >
              <option value="">
                {kind === "allocate"
                  ? "Choose a rent bill"
                  : "Keep as advance money (rent due stays)"}
              </option>
              {s.invoices
                .filter((i) => i.tenantId === tenantId && balance(s, i) > 0)
                .sort((a, b) => a.due.localeCompare(b.due))
                .map((i) => (
                  <option value={i.id} key={i.id}>
                    {displayMonth(i.month)} · {rupees(balance(s, i))} due
                  </option>
                ))}
            </select>
          </Field>
          {kind === "payment" && !invoiceId && tenantId && (
            <p className="notice">
              This payment will be kept as advance money. It will not clear rent
              due until you use it for a rent bill.
            </p>
          )}
          {amountField}
          {kind === "payment" && (
            <>
              {input("Payment date", "date", "date", today(), true)}
              {select("Method", "method", methods, "UPI")}
              {input("Payment reference (optional)", "reference")}
            </>
          )}
        </div>
        {kind === "allocate" && (
          <p>
            Available advance:{" "}
            {rupees(
              payment!.amount -
                s.allocations
                  .filter((a) => a.paymentId === id)
                  .reduce((v, a) => v + a.amount, 0),
            )}
          </p>
        )}
        {!invoiceId && (
          <p className="notice">
            Advance money is kept separately. Choose a rent bill when you want
            to use it for rent.
          </p>
        )}
      </>
    );
  if (kind === "expense")
    content = (
      <>
        <div className="form-grid">
          {input("Title *", "title", "text", expense?.title, true)}
          {amountField}
          {select("Category", "category", expenseCategories, expense?.category)}
          {input("Date", "date", "date", expense?.date || today(), true)}
          {select("Payment method", "method", methods, expense?.method)}
          {input("Paid to", "vendor", "text", expense?.vendor)}
          {input("Receipt note", "receipt", "text", expense?.receipt)}
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            name="recurring"
            defaultChecked={expense?.recurring}
          />{" "}
          Mark as a repeat expense (you will add each payment yourself)
        </label>
      </>
    );
  if (kind === "reservation")
    content = (
      <>
        <div className="form-grid">
          {input("Prospect name *", "name", "text", "", true)}
          {input("Phone *", "phone", "tel", "", true)}
          {bedSelect}
          {select("Status", "status", ["Pending", "Confirmed"], "Confirmed")}
          {input("Expected check-in", "checkIn", "date", today(), true)}
          {input("Reservation expiry", "expires", "date", today(), true)}
          {input("Booking amount held (₹)", "booking", "number", "0")}
        </div>
        <p className="notice">
          Booking money is separate from rent and deposits. Record how you use
          or return it later.
        </p>
      </>
    );
  if (kind === "ticket")
    content = (
      <>
        <div className="form-grid">
          <Field label="Room *">
            <select
              required
              value={roomId}
              onChange={(e) => {
                setRoom(e.target.value);
                setBed("");
              }}
            >
              <option value="">Choose a room</option>
              {s.rooms
                .filter((r) => !r.archived)
                .map((r) => (
                  <option value={r.id} key={r.id}>
                    Room {r.number}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Bed (optional)">
            <select value={bedId} onChange={(e) => setBed(e.target.value)}>
              <option value="">Whole room</option>
              {activeBeds(s)
                .filter((b) => b.roomId === roomId)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label} · {bedStatus(s, b)}
                  </option>
                ))}
            </select>
          </Field>
          {select("Category", "category", [
            "Electrical",
            "Plumbing",
            "Internet",
            "Furniture",
            "Cleaning",
            "Bathroom",
            "Other",
          ])}
          {select(
            "Priority",
            "priority",
            ["Low", "Medium", "High", "Urgent"],
            "Medium",
          )}
        </div>
        <Field label="Description *">
          <textarea name="description" required minLength={3} />
        </Field>
        <label className="check-label">
          <input type="checkbox" name="block" defaultChecked={!!editor.bedId} />{" "}
          Keep this bed unavailable until the problem is fixed
        </label>
      </>
    );
  if (kind === "transfer" || kind === "checkout")
    content = (
      <>
        <h3>{tenant?.name}</h3>
        <p>
          Current bed:{" "}
          <strong>{s.beds.find((b) => b.id === stay?.bedId)?.label}</strong>
        </p>
        {kind === "transfer" && bedSelect}
        {input(
          kind === "transfer" ? "Transfer date" : "Checkout date",
          "date",
          "date",
          today(),
          true,
        )}
        {kind === "checkout" && (
          <>
            <div className="detail-metrics">
              <div>
                <small>Rent still due</small>
                <strong>
                  {rupees(
                    s.invoices
                      .filter((i) => i.tenantId === id)
                      .reduce((v, i) => v + balance(s, i), 0),
                  )}
                </strong>
              </div>
              <div>
                <small>Deposit you still have</small>
                <strong>{rupees(held)}</strong>
              </div>
            </div>
            <p className="notice">
              This frees the bed. If you keep or return any deposit money,
              record it under Deposit history. Unpaid rent will still be due.
            </p>
          </>
        )}
        <label className="check-label">
          <input name="cleaning" type="checkbox" defaultChecked /> Mark previous
          bed for cleaning
        </label>
      </>
    );
  if (kind === "deposit")
    content = (
      <>
        <h3>{tenant?.name}</h3>
        <div className="detail-metrics">
          <div>
            <small>Deposit currently held</small>
            <strong>{rupees(held)}</strong>
          </div>
          <div>
            <small>Agreed deposit</small>
            <strong>{rupees(stay?.deposit || 0)}</strong>
          </div>
        </div>
        <div className="form-grid">
          <Field label="Deposit action">
            <select
              value={depositType}
              onChange={(e) => setDepositType(e.target.value)}
            >
              {["Collected", "Deduction", "Refund"].map((t) => (
                <option key={t} value={t}>
                  {depositActionLabel(t)}
                </option>
              ))}
            </select>
          </Field>
          {amountField}
          {input("Transaction date", "date", "date", today(), true)}
        </div>
        {s.deposits
          .filter((d) => d.tenantId === id)
          .map((d) => (
            <div className="report-row" key={d.id}>
              <span>
                {depositActionLabel(d.type)} · {displayDate(d.date)}
              </span>
              <strong>{rupees(d.amount)}</strong>
            </div>
          ))}
      </>
    );
  return (
    <Modal wide title={titles[kind] || "Update record"} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="dialog-body">
          {content}
          {!["ticket", "allocate"].includes(kind) && (
            <Field label="Notes">
              <textarea name="notes" defaultValue={expense?.notes} />
            </Field>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </div>
        <div className="dialog-footer">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button key="confirm" type="submit" disabled={busy}>
            {busy
              ? "Saving…"
              : kind === "checkout"
                ? "Confirm checkout"
                : "Save record"}{" "}
            <Check size={16} />
          </Button>
        </div>
      </form>
    </Modal>
  );
}
