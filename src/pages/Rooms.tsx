import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Plus,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  BedDouble,
  ArrowUpRight,
  Wind,
  Wifi,
  Pencil,
  Archive,
  Building2,
} from "lucide-react";
import { useApp } from "../hooks/useApp";
import { activeBeds, bedStatus } from "../domain/calculations";
import { rupees } from "../domain/models";
import { Button, Badge, Empty, Modal, SectionTitle } from "../components/ui";
import { service } from "../data";
import { toast } from "sonner";
export default function Rooms() {
  const { s, open } = useApp(),
    [params, setParams] = useSearchParams(),
    { id } = useParams(),
    navigate = useNavigate(),
    [query, setQuery] = useState(""),
    [sharing, setSharing] = useState("all"),
    [ac, setAc] = useState("all"),
    [view, setView] = useState("grid"),
    [sort, setSort] = useState("number"),
    [page, setPage] = useState(1),
    [advanced, setAdvanced] = useState(false),
    [min, setMin] = useState(""),
    [max, setMax] = useState(""),
    [archive, setArchive] = useState(""),
    [busy, setBusy] = useState(false);
  const status = params.get("status") || "all",
    floor = params.get("floor") || "all",
    beds = activeBeds(s);
  const filtered = s.rooms
    .filter(
      (r) =>
        !r.archived &&
        r.number.toLowerCase().includes(query.toLowerCase()) &&
        (floor === "all" || r.floor === Number(floor)) &&
        (sharing === "all" || r.capacity === Number(sharing)) &&
        (ac === "all" || r.facilities.includes("AC") === (ac === "AC")) &&
        (!min || r.rent >= Number(min) * 100) &&
        (!max || r.rent <= Number(max) * 100) &&
        (status === "all" ||
          (status === "Full"
            ? beds
                .filter((b) => b.roomId === r.id)
                .every((b) => bedStatus(s, b) === "Occupied")
            : status === "Vacant"
              ? beds
                  .filter((b) => b.roomId === r.id)
                  .every((b) => bedStatus(s, b) === "Available")
              : beds.some(
                  (b) => b.roomId === r.id && bedStatus(s, b) === status,
                ))),
    )
    .sort((a, b) =>
      sort === "rent"
        ? a.rent - b.rent
        : a.number.localeCompare(b.number, undefined, { numeric: true }),
    );
  const update = (key: string, value: string) => {
    setParams((p) => {
      p.set(key, value);
      return p;
    });
    setPage(1);
  };
  const selected = s.rooms.find((r) => r.id === id);
  const roomCard = (r: (typeof s.rooms)[number]) => {
    const rb = beds.filter((b) => b.roomId === r.id),
      occ = rb.filter((b) => bedStatus(s, b) === "Occupied").length,
      av = rb.filter((b) => bedStatus(s, b) === "Available").length;
    return (
      <article className="room-card" key={r.id}>
        <div className="room-card-top">
          <div className="room-symbol">
            <BedDouble size={24} />
          </div>
          <div>
            <h3>Room {r.number}</h3>
            <p>
              {r.floor === 0 ? "Ground floor" : `Floor ${r.floor}`}{" "}
              <span>·</span> {r.capacity}-sharing
            </p>
          </div>
          <button
            className="icon-button"
            aria-label={`Edit room ${r.number}`}
            onClick={() => open({ kind: "room", id: r.id })}
          >
            <Pencil size={16} />
          </button>
        </div>
        <div className="room-rent">
          <strong>{rupees(r.rent)}</strong>
          <span>/ bed / month</span>
          <Badge status={av ? "Available" : "Occupied"}>
            {av ? `${av} available` : "Full"}
          </Badge>
        </div>
        <div className="facilities">
          {r.facilities.includes("AC") && (
            <span>
              <Wind size={14} /> AC
            </span>
          )}
          <span>
            <Wifi size={14} /> Wi-Fi
          </span>
          <span>
            {r.facilities.includes("Attached Bathroom")
              ? "Attached bath"
              : "Common bath"}
          </span>
        </div>
        <div className="bed-map">
          {rb.map((b) => (
            <button
              key={b.id}
              className={`bed ${bedStatus(s, b).toLowerCase()}`}
              title={`${b.label} · ${bedStatus(s, b)}`}
              aria-label={`Bed ${b.label}: ${bedStatus(s, b)}`}
              onClick={() => open({ kind: "bed", id: b.id })}
            >
              <BedDouble size={22} />
              <span>{b.label.split("-").at(-1)}</span>
            </button>
          ))}
        </div>
        <div className="room-card-footer">
          <span>
            {occ} of {rb.length} occupied
          </span>
          <button onClick={() => navigate(`/app/rooms/${r.id}`)}>
            Room details <ArrowUpRight size={14} />
          </button>
        </div>
      </article>
    );
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ROOMS IN YOUR PG</div>
          <h1>Rooms & beds</h1>
          <p>See rooms, beds, rent, and which beds are free.</p>
        </div>
        <Button onClick={() => open({ kind: "room" })}>
          <Plus size={17} /> Add room
        </Button>
      </div>
      <div className="mini-stats">
        {["Available", "Occupied", "Reserved", "Maintenance", "Cleaning"].map(
          (st) => (
            <button
              key={st}
              onClick={() => update("status", st)}
              className={status === st ? "selected" : ""}
            >
              <Badge status={st}>{st}</Badge>
              <strong>
                {beds.filter((b) => bedStatus(s, b) === st).length}
              </strong>
              <span>beds</span>
            </button>
          ),
        )}
      </div>
      <section className="panel room-list-panel">
        <div className="list-toolbar room-toolbar">
          <div className="input-search">
            <Search size={17} />
            <input
              aria-label="Search rooms"
              placeholder="Search room number…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            aria-label="Floor"
            value={floor}
            onChange={(e) => update("floor", e.target.value)}
          >
            <option value="all">All floors</option>
            {Array.from({ length: s.settings[0].floors }, (_, i) => (
              <option value={i} key={i}>
                {i === 0 ? "Ground floor" : `Floor ${i}`}
              </option>
            ))}
          </select>
          <select
            aria-label="Sharing type"
            value={sharing}
            onChange={(e) => {
              setSharing(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All sharing types</option>
            {Array.from({ length: s.settings[0].maxCapacity }, (_, i) => (
              <option value={i + 1} key={i}>
                {i + 1}-sharing
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={() => setAdvanced(!advanced)}>
            <SlidersHorizontal size={15} /> Filters
          </Button>
          <div className="view-toggle">
            <button
              className={view === "grid" ? "active" : ""}
              aria-label="Grid view"
              onClick={() => setView("grid")}
            >
              <LayoutGrid size={17} />
            </button>
            <button
              className={view === "table" ? "active" : ""}
              aria-label="Table view"
              onClick={() => setView("table")}
            >
              <List size={17} />
            </button>
          </div>
        </div>
        {advanced && (
          <div className="filter-row">
            <select
              aria-label="Room status"
              value={status}
              onChange={(e) => update("status", e.target.value)}
            >
              {[
                "all",
                "Available",
                "Occupied",
                "Reserved",
                "Maintenance",
                "Cleaning",
                "Full",
                "Vacant",
              ].map((v) => (
                <option key={v} value={v}>
                  {v === "all" ? "All statuses" : v}
                </option>
              ))}
            </select>
            <select
              aria-label="Air conditioning"
              value={ac}
              onChange={(e) => setAc(e.target.value)}
            >
              <option value="all">AC & Non-AC</option>
              <option>AC</option>
              <option>Non-AC</option>
            </select>
            <input
              type="number"
              aria-label="Minimum rent"
              placeholder="Min rent ₹"
              value={min}
              onChange={(e) => setMin(e.target.value)}
            />
            <input
              type="number"
              aria-label="Maximum rent"
              placeholder="Max rent ₹"
              value={max}
              onChange={(e) => setMax(e.target.value)}
            />
            <select
              aria-label="Sort rooms"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="number">Room number</option>
              <option value="rent">Rent: low to high</option>
            </select>
            <Button
              variant="ghost"
              onClick={() => {
                setParams({});
                setSharing("all");
                setAc("all");
                setMin("");
                setMax("");
                setQuery("");
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
        <div className="list-meta">
          <span>
            {filtered.length} rooms{" "}
            <span className="muted">· Click a bed to manage it</span>
          </span>
          <div className="legend compact-legend">
            <span>
              <i style={{ background: "#35b8ba" }} />
              Available
            </span>
            <span>
              <i style={{ background: "#33aa7b" }} />
              Occupied
            </span>
            <span>
              <i style={{ background: "#e9b354" }} />
              Reserved
            </span>
          </div>
        </div>
        {!filtered.length ? (
          <Empty
            title="No rooms match"
            description="Adjust your filters or add a new room."
          />
        ) : view === "grid" ? (
          <div className="room-grid">
            {filtered.slice((page - 1) * 9, page * 9).map(roomCard)}
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {[
                    "Room",
                    "Floor",
                    "Sharing",
                    "Occupied",
                    "Available",
                    "Rent / bed",
                    "Actions",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice((page - 1) * 9, page * 9).map((r) => (
                  <tr key={r.id}>
                    <td data-label="Room">
                      <button
                        className="text-link"
                        onClick={() => navigate(`/app/rooms/${r.id}`)}
                      >
                        Room {r.number}
                      </button>
                    </td>
                    <td data-label="Floor">{r.floor}</td>
                    <td data-label="Sharing">{r.capacity}-sharing</td>
                    <td data-label="Occupied">
                      {
                        beds.filter(
                          (b) =>
                            b.roomId === r.id && bedStatus(s, b) === "Occupied",
                        ).length
                      }
                    </td>
                    <td data-label="Available">
                      {
                        beds.filter(
                          (b) =>
                            b.roomId === r.id &&
                            bedStatus(s, b) === "Available",
                        ).length
                      }
                    </td>
                    <td data-label="Rent / bed">{rupees(r.rent)}</td>
                    <td data-label="">
                      <Button
                        variant="ghost"
                        onClick={() => open({ kind: "room", id: r.id })}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <span>
            Page {page} of {Math.max(1, Math.ceil(filtered.length / 9))}
          </span>
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={page * 9 >= filtered.length}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </section>
      {selected && (
        <Modal
          title={`Room ${selected.number}`}
          onClose={() => navigate("/app/rooms")}
          wide
        >
          <div className="dialog-body">
            <SectionTitle
              title={`${selected.capacity}-sharing · Floor ${selected.floor}`}
              sub={selected.description}
            />
            <div className="detail-metrics">
              <div>
                <small>Monthly rent / bed</small>
                <strong>{rupees(selected.rent)}</strong>
              </div>
              <div>
                <small>Security deposit</small>
                <strong>{rupees(selected.deposit)}</strong>
              </div>
            </div>
            <p>{selected.facilities.join(" · ")}</p>
            {roomCard(selected)}
            <div className="button-row">
              <Button onClick={() => open({ kind: "room", id: selected.id })}>
                <Pencil size={16} /> Edit room
              </Button>
              <Button variant="danger" onClick={() => setArchive(selected.id)}>
                <Archive size={16} /> Hide room
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {archive && (
        <Modal
          title="Hide this room?"
          description="The room will not appear when choosing a bed. Old stays and payments will remain saved."
          onClose={() => setArchive("")}
        >
          <div className="dialog-body">
            <Building2 size={30} />
            <p>You can only hide a room when all its beds are free.</p>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await service.archiveRoom(archive);
                  setArchive("");
                  navigate("/app/rooms");
                  toast.success("Room hidden");
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Hide room
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
