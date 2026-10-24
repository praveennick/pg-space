import { useState } from "react";
import type { Snapshot } from "../domain/models";
import { rupees } from "../domain/models";
import { scopeRooms } from "../domain/reporting";
import { metrics, depositHeld } from "../domain/calculations";
import { SectionTitle, Button } from "../components/ui";
import { exportCsv } from "../services/export";
import { displayDate } from "../domain/dates";
export function ReportDetails({
  s,
  from,
  to,
}: {
  s: Snapshot;
  from: string;
  to: string;
}) {
  const [tab, setTab] = useState("Rent by room");
  const [page, setPage] = useState(1);
  const rooms = s.rooms
    .filter((r) => !r.archived)
    .sort((a, b) => a.number.localeCompare(b.number));
  const revenue = rooms.map((r) => {
    const v = scopeRooms(s, "all", r.id),
      m = metrics(v, from, to);
    return [
      `Room ${r.number}`,
      r.capacity,
      m.counts.Occupied,
      m.total,
      m.billed / 100,
      m.collected / 100,
      m.pending / 100,
    ];
  });
  const sharing = [...new Set(rooms.map((r) => r.capacity))]
    .sort((a, b) => a - b)
    .map((cap) => {
      const m = metrics(scopeRooms(s, "all", "all", String(cap)), from, to);
      return [
        `${cap}-sharing`,
        m.rooms,
        m.total,
        m.counts.Occupied,
        `${m.occupancy}%`,
        m.collected / 100,
      ];
    });
  const stays = s.occupancies
    .filter(
      (o) =>
        (o.start >= from && o.start <= to) ||
        (o.end && o.end >= from && o.end <= to),
    )
    .map((o) => [
      s.tenants.find((t) => t.id === o.tenantId)?.name || "",
      s.beds.find((b) => b.id === o.bedId)?.label || "",
      displayDate(o.start),
      o.end ? displayDate(o.end) : "Active",
      o.rent / 100,
    ]);
  const deposits = s.tenants
    .filter((t) => s.deposits.some((d) => d.tenantId === t.id))
    .map((t) => [
      t.name,
      ...["Collected", "Deduction", "Refund"].map(
        (type) =>
          s.deposits
            .filter((d) => d.tenantId === t.id && d.type === type)
            .reduce((v, d) => v + d.amount, 0) / 100,
      ),
      depositHeld(s, t.id) / 100,
    ]);
  const headers =
    tab === "Rent by room"
      ? [
          "Room",
          "Sharing",
          "Occupied",
          "Beds",
          "Rent charged INR",
          "Rent paid INR",
          "Rent due INR",
        ]
      : tab === "By sharing type"
        ? ["Type", "Rooms", "Beds", "In use", "Beds in use", "Rent paid INR"]
        : tab === "Resident stays"
          ? ["Resident", "Bed", "Check-in", "Checkout", "Rent INR"]
          : [
              "Resident",
              "Collected INR",
              "Kept for charges INR",
              "Returned INR",
              "Still held INR",
            ];
  const rows =
    tab === "Rent by room"
      ? revenue
      : tab === "By sharing type"
        ? sharing
        : tab === "Resident stays"
          ? stays
          : deposits;
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  return (
    <section className="panel report-details" style={{ marginBottom: 22 }}>
      <SectionTitle
        title="More details"
        sub="Rent is shown for the room where the resident stayed. Deposits show the amount still held."
        action={
          <Button
            variant="outline"
            onClick={() =>
              exportCsv(`${tab.toLowerCase().replaceAll(" ", "-")}.csv`, [
                headers,
                ...rows,
              ])
            }
          >
            Export this report
          </Button>
        }
      />
      <div className="tabs" aria-label="Report views">
        {[
          "Rent by room",
          "By sharing type",
          "Resident stays",
          "Deposits held",
        ].map((t) => (
          <button
            key={t}
            className={t === tab ? "active" : ""}
            aria-pressed={t === tab}
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows
              .slice((currentPage - 1) * pageSize, currentPage * pageSize)
              .map((r, i) => (
                <tr key={`${currentPage}-${i}`}>
                  {r.map((v, j) => (
                    <td key={j} data-label={headers[j]}>
                      {headers[j].includes("INR") ? rupees(Number(v) * 100) : v}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {rows.length > pageSize && (
        <div className="pagination">
          <span>
            Page {currentPage} of {pageCount} · {rows.length} records
          </span>
          <Button
            variant="outline"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={currentPage === pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}
      {!rows.length && <p>Nothing to show for these dates and rooms.</p>}
    </section>
  );
}
