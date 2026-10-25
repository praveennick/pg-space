import { scopeRooms } from "../domain/reporting";
import { ReportDetails } from "../components/ReportDetails";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  BedDouble,
  Building2,
  Users,
  Wallet,
  Plus,
  Download,
  CalendarDays,
  Sparkles,
  CircleCheck,
  Clock3,
  Wrench,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { motion } from "motion/react";
import { format, subMonths } from "date-fns";
import { useApp } from "../hooks/useApp";
import {
  metrics,
  activeBeds,
  bedStatus,
  balance,
  depositHeld,
} from "../domain/calculations";
import { monthNow, rupees, today } from "../domain/models";
import { displayDate, displayMonth } from "../domain/dates";
import { DateInput } from "../components/DateInput";
import { Button, Badge, SectionTitle } from "../components/ui";
import { exportCsv } from "../services/export";
import { WhatsAppReminder } from "../components/WhatsAppReminder";
export default function Dashboard({ reports = false }: { reports?: boolean }) {
  const { s, open } = useApp(),
    [period, setPeriod] = useState("Current Month"),
    [customFrom, setFrom] = useState(`${monthNow()}-01`),
    [customTo, setTo] = useState(today()),
    [floor, setFloor] = useState("all"),
    [roomFilter, setRoomFilter] = useState("all"),
    [sharingFilter, setSharingFilter] = useState("all");
  const date = new Date(`${today()}T12:00:00`),
    from =
      period === "Custom Range"
        ? customFrom
        : period === "This Year"
          ? `${today().slice(0, 4)}-01-01`
          : format(
              subMonths(
                date,
                period === "Previous Month"
                  ? 1
                  : period === "Last 3 Months"
                    ? 2
                    : period === "Last 6 Months"
                      ? 5
                      : 0,
              ),
              "yyyy-MM-01",
            ),
    to =
      period === "Custom Range"
        ? customTo
        : period === "Previous Month"
          ? format(
              new Date(date.getFullYear(), date.getMonth(), 0),
              "yyyy-MM-dd",
            )
          : today();
  const view = scopeRooms(s, floor, roomFilter, sharingFilter);
  const m = metrics(view, from, to),
    trend = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(date, 5 - i),
        mo = format(d, "yyyy-MM"),
        stat = metrics(view, `${mo}-01`, `${mo}-31`);
      return {
        name: format(d, "MMM"),
        collected: stat.collected / 100,
        outstanding: stat.pending / 100,
        expenses: stat.expenses / 100,
        cash: stat.cash / 100,
      };
    });
  const pie = [
    { name: "Occupied", value: m.counts.Occupied, color: "#7165ec" },
    { name: "Available", value: m.counts.Available, color: "#38bfc4" },
    { name: "Reserved", value: m.counts.Reserved, color: "#f5b958" },
    {
      name: "Blocked",
      value: m.counts.Maintenance + m.counts.Cleaning,
      color: "#e5e7f1",
    },
  ];
  const pending = s.invoices
    .filter((i) => balance(s, i) > 0)
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 4);
  const payments = [...s.payments]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const exportReport = () =>
    exportCsv("pg-space-report.csv", [
      ["Period", displayDate(from), displayDate(to)],
      ["Rooms", m.rooms],
      ["Total beds", m.total],
      ["Occupied", m.counts.Occupied],
      ["Rent charged INR", m.billed / 100],
      ["Rent paid INR", m.collected / 100],
      ["Rent due INR", m.pending / 100],
      ["Expenses INR", m.expenses / 100],
      ["Rent received minus expenses INR", m.cash / 100],
      ["Deposits held INR", depositHeld(view) / 100],
    ]);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">TODAY AT YOUR PG</div>
          <h1>
            {reports ? "Reports" : "Your PG today"}
            <span className="greeting-dot">✦</span>
          </h1>
          <p>
            {reports
              ? "See rooms, rent, and expenses in one place."
              : `See what needs attention at ${s.settings[0].name}.`}
          </p>
        </div>
        <div className="heading-actions">
          <Button variant="outline" onClick={exportReport}>
            <Download size={16} /> Export {reports ? "CSV" : "report"}
          </Button>
          <Button onClick={() => open({ kind: "tenant" })}>
            <Plus size={17} /> Add tenant
          </Button>
        </div>
      </div>
      <div className="dashboard-toolbar">
        <div className="overview-label">
          <span className="live-dot" />
          Latest numbers <span className="muted">·</span>
          <span className="muted">{displayDate(today())}</span>
        </div>
        <div className="filter-group">
          <select
            aria-label="Floor filter"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
          >
            <option value="all">All floors</option>
            {Array.from({ length: s.settings[0].floors }, (_, i) => (
              <option key={i} value={i}>
                {i === 0 ? "Ground floor" : `Floor ${i}`}
              </option>
            ))}
          </select>
          <CalendarDays size={15} />
          <select
            aria-label="Reporting period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            {[
              "Current Month",
              "Previous Month",
              "Last 3 Months",
              "Last 6 Months",
              "This Year",
              "Custom Range",
            ].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>
      {period === "Custom Range" && (
        <div className="filter-row">
          <label>
            From{" "}
            <DateInput label="From" value={customFrom} onChange={setFrom} />
          </label>
          <label>
            To{" "}
            <DateInput
              label="To"
              min={customFrom}
              value={customTo}
              onChange={setTo}
            />
          </label>
        </div>
      )}
      <div className="kpi-grid">
        {[
          {
            label: "Total rooms",
            value: m.rooms,
            icon: Building2,
            color: "purple",
            note: `Across ${s.settings[0].floors} floors`,
            link: "/app/rooms",
            detail: `${m.total} total beds`,
          },
          {
            label: "Occupied beds",
            value: m.counts.Occupied,
            icon: Users,
            color: "blue",
            note: "Beds ready to use",
            link: "/app/tenants",
            detail: `${m.occupancy}% occupied`,
          },
          {
            label: "Available beds",
            value: m.counts.Available,
            icon: BedDouble,
            color: "teal",
            note: "Ready for a new resident",
            link: "/app/rooms?status=Available",
            detail: `${m.counts.Reserved} reserved`,
          },
          {
            label: "Rent collected",
            value: rupees(m.collected),
            icon: Wallet,
            color: "purple",
            note: `${rupees(m.pending)} rent still due`,
            link: "/app/payments",
            detail: `${m.billed ? Math.round((m.collected / m.billed) * 100) : 0}% collected`,
          },
        ].map((k, i) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            key={k.label}
          >
            <Link to={k.link} className="kpi-card">
              <div className="kpi-top">
                <span>{k.label}</span>
                <span className={`metric-icon ${k.color}`}>
                  <k.icon size={20} />
                </span>
              </div>
              <div className="kpi-value">
                {k.value}
                <ArrowUpRight size={18} />
              </div>
              <div className="kpi-bottom">
                <span className={`metric-note ${k.color}`}>{k.detail}</span>
                <small>{k.note}</small>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
      <div className="chart-grid">
        <section className="panel collection-panel">
          <SectionTitle
            title="Rent collection"
            sub="Rent paid and rent still due each month"
            action={<Badge status="paid">Last 6 months</Badge>}
          />
          <div className="chart-summary">
            <div>
              <small>Collected this period</small>
              <strong>{rupees(m.collected)}</strong>
            </div>
            <div className="legend">
              <span>
                <i style={{ background: "#7764e9" }} />
                Collected
              </span>
              <span>
                <i style={{ background: "#b7c4d9" }} />
                Still due
              </span>
            </div>
          </div>
          <div className="chart-height">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trend}
                margin={{ top: 15, right: 5, left: -16, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="rentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8a78f0" stopOpacity={0.28} />
                    <stop
                      offset="100%"
                      stopColor="#8a78f0"
                      stopOpacity={0.015}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 5"
                  vertical={false}
                  stroke="var(--border)"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                  tickFormatter={(v) => `₹${v / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                  }}
                  formatter={(v) => rupees(Number(v) * 100)}
                />
                <Area
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="outstanding"
                  stroke="#b7c4d9"
                  fill="transparent"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
                <Area
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="collected"
                  stroke="#7864e9"
                  strokeWidth={3}
                  fill="url(#rentGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <details className="chart-data-details">
            <summary>View monthly rent figures</summary>
            <div className="chart-data-rows">
              {trend.map((month) => (
                <div className="chart-data-row" key={month.name}>
                  <strong>{month.name}</strong>
                  <span>
                    Collected {rupees(Math.round(month.collected * 100))}
                  </span>
                  <span>
                    Still due {rupees(Math.round(month.outstanding * 100))}
                  </span>
                </div>
              ))}
            </div>
          </details>
          <div className="chart-foot">
            <span>
              <CircleCheck size={14} /> From your saved rent payments
            </span>
            <Link to="/app/payments">
              View payments <ArrowRight size={14} />
            </Link>
          </div>
        </section>
        <section className="panel occupancy-panel">
          <SectionTitle
            title="Beds right now"
            sub="See which beds are in use or free"
          />
          <div className="donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={pie}
                  dataKey="value"
                  innerRadius="70%"
                  outerRadius="90%"
                  paddingAngle={5}
                  cornerRadius={5}
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                >
                  {pie.map((p) => (
                    <Cell key={p.name} fill={p.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <strong>
                {m.occupancy}
                <small>%</small>
              </strong>
              <span>Beds in use</span>
            </div>
          </div>
          <div className="occupancy-legend">
            {pie.map((p) => (
              <div key={p.name}>
                <span>
                  <i style={{ background: p.color }} />
                  {p.name}
                </span>
                <strong>
                  {p.value}
                  <small> beds</small>
                </strong>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="middle-grid">
        <section className="panel floors-panel">
          <SectionTitle
            title="Rooms on each floor"
            sub="See where beds are free"
            action={
              <Link className="text-link" to="/app/rooms">
                View rooms <ArrowUpRight size={15} />
              </Link>
            }
          />
          <div className="floors-grid">
            {Array.from({ length: s.settings[0].floors }, (_, f) => {
              const rooms = s.rooms.filter((r) => r.floor === f && !r.archived),
                beds = activeBeds(s).filter((b) =>
                  rooms.some((r) => r.id === b.roomId),
                ),
                occupied = beds.filter(
                  (b) => bedStatus(s, b) === "Occupied",
                ).length;
              return (
                <Link
                  to={`/app/rooms?floor=${f}`}
                  className="floor-card"
                  key={f}
                >
                  <div>
                    <span className="floor-icon">
                      <Building2 size={17} />
                    </span>
                    <ArrowUpRight size={14} />
                  </div>
                  <h3>
                    {f === 0
                      ? "Ground floor"
                      : `${f}${f === 1 ? "st" : f === 2 ? "nd" : "rd"} floor`}
                  </h3>
                  <p>
                    {rooms.length} rooms <span>·</span> {beds.length} beds
                  </p>
                  <div className="progress">
                    <span
                      style={{
                        width: `${beds.length ? (occupied / beds.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <small>
                    <strong>{occupied}</strong> occupied{" "}
                    <span>{beds.length - occupied} other</span>
                  </small>
                </Link>
              );
            })}
          </div>
        </section>
        <section className="quick-panel">
          <div className="sparkle">
            <Sparkles size={22} />
          </div>
          <h2>
            Manage your PG.
            <br />
            One task at a time.
          </h2>
          <p>
            Add a room or record rent,
            <br />
            whenever you need to.
          </p>
          <div>
            <button onClick={() => open({ kind: "payment" })}>
              <Wallet size={17} /> Collect rent <ArrowRight size={15} />
            </button>
            <button onClick={() => open({ kind: "room" })}>
              <BedDouble size={17} /> Add a room <ArrowRight size={15} />
            </button>
          </div>
        </section>
      </div>
      <div className="lower-grid">
        <section className="panel">
          <SectionTitle
            title="Recent payments"
            sub="Payments you recorded recently"
            action={
              <Link className="text-link" to="/app/payments">
                View all <ArrowRight size={14} />
              </Link>
            }
          />
          {!payments.length && <p className="muted">No payments recorded yet.</p>}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={p.id}>
                    <td data-label="Tenant">
                      <div className="person">
                        <span className={`avatar avatar-${i % 4}`}>
                          {s.tenants
                            .find((t) => t.id === p.tenantId)
                            ?.name.slice(0, 2)
                            .toUpperCase()}
                        </span>
                        <div>
                          <strong>
                            {s.tenants
                              .find((t) => t.id === p.tenantId)
                              ?.name.replace(" (Demo)", "")}
                          </strong>
                          <small>
                            Receipt #{p.id.slice(0, 6).toUpperCase()}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td data-label="Amount" className="money">
                      {rupees(p.amount)}
                    </td>
                    <td data-label="Method">{p.method}</td>
                    <td data-label="Date">{displayDate(p.date)}</td>
                    <td data-label="Status">
                      <Badge status="paid">Received</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <SectionTitle
            title="Needs your attention"
            sub="Things to check today"
          />
          <div className="attention-list">
            {pending.slice(0, 2).map((i) => {
              const tenant = s.tenants.find((t) => t.id === i.tenantId);
              return (
                <div className="attention-item" key={i.id}>
                  <Link className="attention-link" to="/app/payments?status=Outstanding">
                    <span className="attention-icon amber">
                      <Clock3 size={18} />
                    </span>
                    <div>
                      <strong>{rupees(balance(s, i))} rent pending</strong>
                      <p>
                        {tenant?.name.replace(" (Demo)", "")} ·{" "}
                        {displayMonth(i.month)}
                      </p>
                    </div>
                    <ArrowUpRight size={15} />
                  </Link>
                  <WhatsAppReminder
                    tenantId={i.tenantId}
                    invoiceId={i.id}
                    label="Remind"
                    variant="ghost"
                    className="reminder-inline"
                  />
                </div>
              );
            })}
            {s.tickets
              .filter((t) => !["Closed", "Resolved"].includes(t.status))
              .slice(0, 1)
              .map((t) => (
                <Link key={t.id} to="/app/maintenance">
                  <span className="attention-icon rose">
                    <Wrench size={18} />
                  </span>
                  <div>
                    <strong>{t.category} needs a look</strong>
                    <p>
                      Room {s.rooms.find((r) => r.id === t.roomId)?.number} ·{" "}
                      {t.priority} priority
                    </p>
                  </div>
                  <ArrowUpRight size={15} />
                </Link>
              ))}
            <Link className="attention-bottom" to="/app/notifications">
              View all notifications <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      </div>
      {reports && (
        <>
          <div className="filter-row">
            <select
              aria-label="Report room"
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
            >
              <option value="all">All rooms</option>
              {s.rooms
                .filter((r) => !r.archived)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.number}
                  </option>
                ))}
            </select>
            <select
              aria-label="Report sharing"
              value={sharingFilter}
              onChange={(e) => setSharingFilter(e.target.value)}
            >
              <option value="all">All sharing types</option>
              {[...new Set(s.rooms.map((r) => r.capacity))]
                .sort((a, b) => a - b)
                .map((n) => (
                  <option key={n} value={n}>
                    {n}-sharing
                  </option>
                ))}
            </select>
            <small className="muted">
              Expenses are for the whole PG, even when you filter to one room.
            </small>
          </div>
          <div className="report-metrics">
            {[
              ["Rent charged", m.billed],
              ["Overdue rent", m.overdue],
              ["PG expenses", m.expenses],
              ["Rent received minus expenses", m.cash],
              ["Deposits still held", depositHeld(s)],
            ].map(([label, v]) => (
              <div className="panel" key={label}>
                <small>{label}</small>
                <h2>{rupees(Number(v))}</h2>
              </div>
            ))}
          </div>
          <div className="chart-grid">
            <section className="panel">
              <SectionTitle
                title="Rent left after expenses"
                sub="Rent received minus PG expenses. Deposits are separate."
              />
              <div className="chart-height">
                <ResponsiveContainer>
                  <BarChart data={trend}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted)", fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted)", fontSize: 11 }}
                      tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                      }}
                      formatter={(v) => rupees(Math.round(Number(v) * 100))}
                    />
                    <Bar
                      isAnimationActive={false}
                      dataKey="cash"
                      fill="#7764e9"
                      radius={[5, 5, 0, 0]}
                    />
                    <Bar
                      isAnimationActive={false}
                      dataKey="expenses"
                      fill="#38bfc4"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <details className="chart-data-details">
                <summary>See monthly income and expenses</summary>
                <div className="chart-data-rows">
                  {trend.map((month) => (
                    <div className="chart-data-row" key={month.name}>
                      <strong>{month.name}</strong>
                      <span>
                        Cash flow {rupees(Math.round(month.cash * 100))}
                      </span>
                      <span>
                        Expenses {rupees(Math.round(month.expenses * 100))}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            </section>
            <section className="panel">
              <SectionTitle
                title="Expense breakdown"
                sub="Selected reporting period"
              />
              {[...new Set(s.expenses.map((e) => e.category))].map((c) => {
                const v = s.expenses
                  .filter(
                    (e) => e.category === c && e.date >= from && e.date <= to,
                  )
                  .reduce((v, e) => v + e.amount, 0);
                return (
                  <div className="report-row" key={c}>
                    <span>{c}</span>
                    <strong>{rupees(v)}</strong>
                  </div>
                );
              })}
              <Button variant="outline" onClick={() => window.print()}>
                Print report / Save PDF
              </Button>
            </section>
          </div>
          <ReportDetails s={view} from={from} to={to} />
        </>
      )}
    </>
  );
}
