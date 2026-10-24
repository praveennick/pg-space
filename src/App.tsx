import { AppContext } from "./hooks/useApp";
import { useState, useEffect, useRef, lazy, Suspense, type ReactNode } from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import {
  Building2,
  LayoutDashboard,
  BedDouble,
  Users,
  CalendarDays,
  Wallet,
  Receipt,
  Wrench,
  Bell,
  ChartNoAxesCombined,
  History,
  Settings,
  Search,
  Plus,
  ChevronLeft,
  ChevronDown,
  Moon,
  Sun,
  ArrowUpRight,
  Menu,
  X,
  Monitor,
  CircleHelp,
  FileText,
  LogOut,
  MessageSquareText,
} from "lucide-react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { useData } from "./hooks/useData";
import { firebaseStore, store } from "./data";
import { initialize } from "./data/seed";
import { cloudAuth, firebaseMode } from "./data/firebase";
import { FirebaseSignIn } from "./components/FirebaseSignIn";

import { Button, Modal } from "./components/ui";
import { Editors, type EditorState } from "./components/Editors";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Rooms = lazy(() => import("./pages/Rooms"));
const Tenants = lazy(() => import("./pages/Tenants"));
const Finance = lazy(() => import("./pages/Finance"));
const RemindersPage = lazy(() => import("./pages/Reminders"));
const Operations = lazy(() => import("./pages/Operations"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const Quotations = lazy(() => import("./pages/Quotations"));
const queryClient = new QueryClient();
const nav = [
  ["dashboard", "Overview", LayoutDashboard],
  ["rooms", "Rooms & Beds", BedDouble],
  ["tenants", "Tenants", Users],
  ["reservations", "Reservations", CalendarDays],
  ["payments", "Payments", Wallet],
  ["reminders", "Reminders", MessageSquareText],
  ["quotations", "Quotations", FileText],
  ["expenses", "Expenses", Receipt],
  ["maintenance", "Repairs", Wrench],
  ["notifications", "Updates", Bell],
  ["reports", "Reports", ChartNoAxesCombined],
  ["activity", "Changes made", History],
  ["settings", "Settings", Settings],
] as const;
function AppMenu({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>{label}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className="dropdown" sideOffset={10}>
          {children}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
function Shell() {
  const { data: s, error } = useData(),
    location = useLocation(),
    navigate = useNavigate();
  const [editor, setEditor] = useState<EditorState | null>(null),
    [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(""),
    [mobileSearch, setMobileSearch] = useState(false),
    [help, setHelp] = useState(false);
  const mobileSearchInput = useRef<HTMLInputElement>(null);
  const mobileSearchPanel = useRef<HTMLDivElement>(null);
  const mobileSearchToggle = useRef<HTMLButtonElement>(null);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("pg-theme") || "light",
  );
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    localStorage.setItem("pg-theme", theme);
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.reduced = String(
      s?.settings[0]?.reducedMotion || false,
    );
  }, [s?.settings]);
  useEffect(() => {
    if (!mobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobile(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobile]);
  useEffect(() => {
    if (!mobileSearch) return;
    mobileSearchInput.current?.focus();
    const closeSearch = (event: KeyboardEvent | PointerEvent) => {
      if (event.type === "keydown") {
        if ((event as KeyboardEvent).key !== "Escape") return;
      } else if (
        mobileSearchPanel.current?.contains(event.target as Node) ||
        mobileSearchToggle.current?.contains(event.target as Node)
      ) {
        return;
      }
      setMobileSearch(false);
      setSearch("");
    };
    document.addEventListener("keydown", closeSearch);
    document.addEventListener("pointerdown", closeSearch);
    return () => {
      document.removeEventListener("keydown", closeSearch);
      document.removeEventListener("pointerdown", closeSearch);
    };
  }, [mobileSearch]);
  if (error)
    return (
      <div className="boot">
        <h1>Unable to open saved records</h1>
        <p>{error.message}</p>
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </div>
    );
  if (!s?.settings.length)
    return (
      <div className="boot">
        <div className="brand-mark">
          <Building2 />
        </div>
        <h2>Opening your space…</h2>
        <div className="skeleton" />
      </div>
    );
  const page = location.pathname.split("/")[2] || "dashboard",
    title = nav.find((n) => n[0] === page)?.[1] || "Overview",
    unread = s.notifications.filter((n) => !n.read).length;
  const results = search.trim()
    ? [
        ...s.tenants
          .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
          .slice(0, 4)
          .map((t) => ({
            label: t.name,
            url: `/app/tenants/${t.id}`,
            type: "Tenant",
          })),
        ...s.rooms
          .filter((r) => !r.archived && r.number.includes(search))
          .slice(0, 4)
          .map((r) => ({
            label: `Room ${r.number}`,
            url: `/app/rooms/${r.id}`,
            type: "Room",
          })),
      ]
    : [];
  const selectSearchResult = (url: string) => {
    navigate(url);
    setSearch("");
    setMobileSearch(false);
  };
  const renderSearchResults = () =>
    search.trim() && (
      <div className="search-results">
        {results.length ? (
          results.map((result) => (
            <button
              key={result.url}
              onClick={() => selectSearchResult(result.url)}
            >
              <span>{result.label}</span>
              <small>{result.type}</small>
            </button>
          ))
        ) : (
          <p>No matching rooms or residents.</p>
        )}
        <button onClick={() => setSearch("")}>
          <X size={14} /> Clear search
        </button>
      </div>
    );
  return (
    <AppContext.Provider value={{ s, open: setEditor }}>
      <div
        className={`app ${collapsed ? "compact" : ""} ${mobile ? "menu-open" : ""}`}
      >
        {mobile && (
          <button
            className="mobile-scrim"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          />
        )}
        <aside
          className={`sidebar ${mobile ? "show" : ""}`}
          aria-label="Workspace navigation"
        >
          <NavLink
            className="brand"
            to="/app/dashboard"
            onClick={() => setMobile(false)}
          >
            <span className="brand-mark">
              <Building2 size={23} />
            </span>
            <span>
              PG<span className="brand-light">space</span>
              <small>PROPERTY, SIMPLIFIED.</small>
            </span>
          </NavLink>
          <button
            className="sidebar-close"
            aria-label="Close navigation"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
          <button
            className="property-switch"
            onClick={() => {
              setMobile(false);
              navigate("/app/settings");
            }}
          >
            <span className="property-icon">
              <Building2 size={19} />
            </span>
            <span>
              <strong>{s.settings[0].name}</strong>
              <small>Bengaluru · 1 property</small>
            </span>
            <ChevronDown size={15} />
          </button>
          <div className="nav-label">WORKSPACE</div>
          <nav>
            {nav.map(([path, label, Icon]) => (
              <NavLink
                key={path}
                title={label}
                to={`/app/${path}`}
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""} ${path === "reports" ? "nav-divider" : ""}`
                }
                onClick={() => setMobile(false)}
              >
                <Icon size={19} />
                <span>{label}</span>
                {path === "notifications" && unread > 0 && <b>{unread}</b>}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="local-card">
              <span className="live-dot" />
              {firebaseMode ? "Saved to Firebase" : "Demo on this device"}
              <p>
                {firebaseMode
                  ? "Your account keeps records in sync."
                  : "Data stays in this browser."}
              </p>
              <button onClick={() => setHelp(true)}>
                How your data is saved <ArrowUpRight size={13} />
              </button>
            </div>
            <button className="profile" onClick={() => setHelp(true)}>
              <span className="avatar">PK</span>
              <span>
                <strong>Property Manager</strong>
                <small>
                  {firebaseMode ? cloudAuth?.currentUser?.email : "PG demo"}
                </small>
              </span>
              <ChevronDown size={15} />
            </button>
            {firebaseMode && cloudAuth && (
              <button
                className="nav-item"
                onClick={() => {
                  if (cloudAuth) void signOut(cloudAuth);
                }}
              >
                <LogOut size={18} />
                <span>Sign out</span>
              </button>
            )}
          </div>
          <button
            className="collapse"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronLeft size={14} />
          </button>
        </aside>
        <div className="workspace">
          <header className="header">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                aria-label="Open navigation"
                onClick={() => setMobile(true)}
              >
                <Menu size={20} />
              </button>
              <span>PG Space</span>
              <span>/</span>
              <strong>{title}</strong>
            </div>
            <div className="header-tools">
              <button
                ref={mobileSearchToggle}
                className="icon-button mobile-search-toggle"
                aria-label={mobileSearch ? "Close search" : "Search residents and rooms"}
                aria-expanded={mobileSearch}
                aria-controls="mobile-search-panel"
                onClick={() => {
                  setMobileSearch(!mobileSearch);
                  setSearch("");
                }}
              >
                {mobileSearch ? <X size={19} /> : <Search size={19} />}
              </button>
              <div className="global-search">
                <Search size={16} />
                <input
                  aria-label="Global search"
                  placeholder="Find a resident or room…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <kbd>⌕</kbd>
                {renderSearchResults()}
              </div>
              <AppMenu
                label={
                  <button className="icon-button" aria-label="Choose theme">
                    {theme === "dark" ? (
                      <Moon size={19} />
                    ) : theme === "system" ? (
                      <Monitor size={19} />
                    ) : (
                      <Sun size={19} />
                    )}
                  </button>
                }
              >
                {["light", "dark", "system"].map((t) => (
                  <Dropdown.Item key={t} onSelect={() => setTheme(t)}>
                    {t[0].toUpperCase() + t.slice(1)} {theme === t ? "✓" : ""}
                  </Dropdown.Item>
                ))}
              </AppMenu>
              <button
                className="icon-button notification-button"
                aria-label="Open notifications"
                onClick={() => navigate("/app/notifications")}
              >
                <Bell size={19} />
                {unread > 0 && <i />}
              </button>
              <span className="header-separator" />
              <AppMenu
                label={
                  <Button className="quick-add">
                    <Plus size={17} /> Add new <ChevronDown size={14} />
                  </Button>
                }
              >
                {[
                  ["room", "Add room"],
                  ["tenant", "Add tenant"],
                  ["payment", "Record payment"],
                  ["expense", "Add expense"],
                  ["reservation", "New reservation"],
                  ["ticket", "Repair request"],
                ].map(([kind, label]) => (
                  <Dropdown.Item
                    key={kind}
                    onSelect={() => setEditor({ kind })}
                  >
                    {label}
                  </Dropdown.Item>
                ))}
              </AppMenu>
            </div>
            {mobileSearch && (
              <div
                id="mobile-search-panel"
                ref={mobileSearchPanel}
                className="mobile-search-panel"
                role="search"
              >
                <div className="mobile-search-field">
                  <Search size={18} aria-hidden="true" />
                  <input
                    ref={mobileSearchInput}
                    aria-label="Search residents and rooms"
                    placeholder="Find a resident or room…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                {renderSearchResults()}
              </div>
            )}
          </header>
          <main>
            <Suspense
              fallback={
                <div className="page-skeleton">
                  <div className="skeleton" />
                  <div className="skeleton" />
                  <div className="skeleton" />
                </div>
              }
            >
              <Routes>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="rooms/:id?" element={<Rooms />} />
                <Route path="tenants/:id?" element={<Tenants />} />
                <Route path="payments" element={<Finance />} />
                <Route path="reminders" element={<RemindersPage />} />
                <Route path="quotations" element={<Quotations />} />
                <Route path="expenses" element={<Finance />} />
                <Route path="reports" element={<Dashboard reports />} />
                <Route path="settings" element={<SettingsPage />} />
                {[
                  "reservations",
                  "maintenance",
                  "notifications",
                  "activity",
                ].map((p) => (
                  <Route key={p} path={p} element={<Operations key={p} />} />
                ))}
                <Route
                  path="*"
                  element={<Navigate to="/app/dashboard" replace />}
                />
              </Routes>
            </Suspense>
            <footer className="page-footer">
              <span>
                <span className="live-dot" />{" "}
                {firebaseMode ? "Saved to Firebase" : "Saved in this browser"}
              </span>
              <span>
                PG Space <span>·</span> Manage your PG in one place.
              </span>
            </footer>
          </main>
        </div>
        <nav className="bottom-nav">
          {nav.slice(0, 3).map(([p, l, I]) => (
            <NavLink key={p} to={`/app/${p}`}>
              <I size={20} />
              <span>
                {l === "Overview" ? "Home" : l === "Rooms & Beds" ? "Beds" : l}
              </span>
            </NavLink>
          ))}
          <NavLink to="/app/payments">
            <Wallet size={20} />
            <span>Payments</span>
          </NavLink>
          <button onClick={() => setMobile(true)}>
            <Menu size={20} />
            <span>More</span>
          </button>
        </nav>
        {editor && <Editors editor={editor} onClose={() => setEditor(null)} />}
        {help && (
          <Modal title="How your data is saved" onClose={() => setHelp(false)}>
            <div className="dialog-body">
              <CircleHelp className="accent" size={32} />
              {firebaseMode ? (
                <p>
                  Your records are saved under your signed-in Firebase account.
                  Sign in with the same account on another device to see them
                  there. Download a backup in Settings before replacing records.
                </p>
              ) : (
                <>
                  <p>
                    This demo saves records in this browser. The sample
                    residents are not real people. You do not need to sign in.
                  </p>
                  <p>
                    Records do not move to your other devices. Clearing browser
                    data can remove them, so download a backup in Settings.
                  </p>
                </>
              )}
              <Button
                onClick={() => {
                  setHelp(false);
                  navigate("/app/settings");
                }}
              >
                Open backup settings
              </Button>
            </div>
          </Modal>
        )}
      </div>
    </AppContext.Provider>
  );
}
function WorkspaceApp() {
  const [ready, setReady] = useState(firebaseMode),
    [error, setError] = useState("");
  useEffect(() => {
    if (firebaseMode) return;
    initialize(store)
      .then(() => setReady(true))
      .catch((e) => setError(String(e)));
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {error ? (
          <div className="boot">
            <h1>Storage unavailable</h1>
            <p>{error}</p>
          </div>
        ) : ready ? (
          <Routes>
            <Route path="/app/*" element={<Shell />} />
            <Route
              path="*"
              element={<Navigate to="/app/dashboard" replace />}
            />
          </Routes>
        ) : (
          <div className="boot">
            <Building2 size={36} />
            <h2>Opening PG Space…</h2>
            <p>Loading your saved records…</p>
          </div>
        )}
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    if (!cloudAuth) return;
    return onAuthStateChanged(cloudAuth, (next) => {
      firebaseStore?.setUser(next?.uid || "");
      queryClient.clear();
      setUser(next);
    });
  }, []);
  if (!firebaseMode) return <WorkspaceApp />;
  if (user === undefined)
    return (
      <div className="boot">
        <Building2 size={36} />
        <h2>Checking your account…</h2>
      </div>
    );
  return user ? <WorkspaceApp key={user.uid} /> : <FirebaseSignIn />;
}
