import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Boxes, CalendarDays,
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, ClipboardList, CreditCard,
  Download, FileBarChart2, Filter, LayoutDashboard, LogOut, Menu, MoreHorizontal,
  Package, Plus, Search, Settings2, ShieldCheck, ShoppingBag, ShoppingCart, Store,
  Truck, UserRound, Users, X,
} from "lucide-react";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";

import { mockRequest } from "./mockApi";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? "/api" : "http://localhost:5000/api");

const MEDICINE_CATEGORIES = [
  "Pain relief",
  "Antibiotics",
  "Vitamins & supplements",
  "Cold & flu",
  "First aid",
  "Prescription",
  "Personal care",
  "Other",
];

// Currency conversion: API/database values are stored in USD.
// All amounts shown in the UI are converted to Indian Rupees.
const USD_TO_INR_RATE = 94.14; // Update this rate when the exchange rate changes.

const usdToInr = (value) => Number(value || 0) * USD_TO_INR_RATE;
const inrToUsd = (value) => Number(value || 0) / USD_TO_INR_RATE;

const formatInr = (value, fractionDigits = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number(value || 0));

const money = (usdValue) => formatInr(usdToInr(usdValue), 0);
const fullMoney = (usdValue) => formatInr(usdToInr(usdValue), 2);

const dateLabel = (
  value,
  options = { month: "short", day: "numeric", year: "numeric" }
) =>
  value ? new Date(value).toLocaleDateString("en-IN", options) : "—";

async function request(path, { token, ...options } = {}) {
  if (
    typeof window !== "undefined" &&
    window.location.hostname.includes("github.io")
  ) {
    return mockRequest(path, { token, ...options });
  }

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(
        data.message || "Unable to complete this request."
      );
      error.status = response.status;
      throw error;
    }

    return data;
  } catch (err) {
    console.warn(
      "API unavailable, fallback to client store:",
      err.message
    );

    return mockRequest(path, { token, ...options });
  }
}

const navItems = [
  {
    title: "Workspace",
    items: [
      { id: "dashboard", label: "Overview", icon: LayoutDashboard },
      { id: "inventory", label: "Inventory", icon: Package, badge: true },
      { id: "sales", label: "Sales & billing", icon: ShoppingCart },
      { id: "suppliers", label: "Suppliers", icon: Truck },
    ],
  },
  {
    title: "Insights",
    items: [
      { id: "reports", label: "Reports", icon: FileBarChart2 },
      { id: "team", label: "Team", icon: Users, adminOnly: true },
    ],
  },
];

// APP
function App() {
  const [token, setToken] = useState(
    localStorage.getItem("medistock-token")
  );

  const [user, setUser] = useState(null);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [checking, setChecking] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const status = await request("/auth/setup-status");

        if (!active) return;

        setSetupNeeded(status.needsSetup);

        const savedToken = localStorage.getItem("medistock-token");

        if (savedToken) {
          try {
            const result = await request("/auth/me", {
              token: savedToken,
            });

            if (active) {
              setToken(savedToken);
              setUser(result.user);
            }
          } catch {
            localStorage.removeItem("medistock-token");

            if (active) setToken(null);
          }
        }
      } catch (error) {
        if (active) {
          setAuthError(
            error.message === "Failed to fetch"
              ? "Can't reach the MediStock API. Start the backend and check your connection."
              : error.message
          );
        }
      } finally {
        if (active) setChecking(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const signIn = async (mode, form) => {
    const result = await request(
      mode === "setup"
        ? "/auth/setup"
        : mode === "register"
          ? "/auth/register"
          : "/auth/login",
      {
        method: "POST",
        body: JSON.stringify(form),
      }
    );

    localStorage.setItem("medistock-token", result.token);

    setToken(result.token);
    setUser(result.user);
    setSetupNeeded(false);
  };

  const signOut = () => {
    localStorage.removeItem("medistock-token");
    setToken(null);
    setUser(null);
  };

  if (checking) {
    return (
      <div className="boot-screen">
        <div className="brand-mark">
          <Activity size={23} />
        </div>
        <span className="loader" />
        Loading your workspace
      </div>
    );
  }

  if (!token || !user) {
    return (
      <AuthScreen
        setupNeeded={setupNeeded}
        initialError={authError}
        onSubmit={signIn}
      />
    );
  }

  return (
    <Workspace
      token={token}
      user={user}
      onSignOut={signOut}
    />
  );
}

// AUTH SCREEN
function AuthScreen({ setupNeeded, initialError, onSubmit }) {
  const [mode, setMode] = useState(
    setupNeeded ? "setup" : "login"
  );

  const [canSetUp, setCanSetUp] = useState(setupNeeded);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);

  const submit = async (event) => {
    event.preventDefault();

    setBusy(true);
    setError("");

    try {
      await onSubmit(mode, form);
    } catch (issue) {
      if (mode === "setup" && issue.status === 409) {
        setCanSetUp(false);
        setMode("register");

        setForm((current) => ({
          ...current,
          password: "",
        }));

        setError(
          "This workspace already has an administrator. You can create an account or sign in."
        );
      } else {
        setError(issue.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-art">
        <div className="auth-brand">
          <div className="brand-mark">
            <Activity size={23} />
          </div>
          <span>
            Medi<span>Stock</span>
          </span>
        </div>

        <div className="auth-art-copy">
          <div className="eyebrow">
            <span className="live-dot" />
            YOUR PHARMACY, IN GOOD HEALTH
          </div>

          <h1>
            Better care starts
            <br />
            behind the counter.
          </h1>

          <p>
            One calm, clear place to keep your inventory, team,
            and customers moving forward.
          </p>
        </div>

        <div className="auth-art-foot">
          <span>
            Inventory that works as hard as you do.
          </span>

          <div className="art-pill">
            <ShieldCheck size={15} />
            Secure workspace
          </div>
        </div>

        <div className="auth-decoration decor-one" />
        <div className="auth-decoration decor-two" />
      </div>

      <section className="auth-panel">
        <div className="auth-mobile-brand">
          <div className="brand-mark">
            <Activity size={22} />
          </div>

          <strong>
            Medi<span>Stock</span>
          </strong>
        </div>

        <div className="auth-form-wrap">
          <div className="auth-kicker">
            {mode === "setup"
              ? "LET'S GET YOU STARTED"
              : mode === "register"
                ? "JOIN THE TEAM"
                : "WELCOME BACK"}
          </div>

          <h2>
            {mode === "setup"
              ? "Set up your workspace"
              : mode === "register"
                ? "Create your account"
                : "Sign in to MediStock"}
          </h2>

          <p className="auth-intro">
            {mode === "setup"
              ? "Create the first administrator account for this workspace."
              : mode === "register"
                ? "Create your account to access inventory and sales."
                : "Sign in with your email and password to access your workspace."}
          </p>

          <form onSubmit={submit} className="auth-form">
            {(mode === "setup" || mode === "register") && (
              <label>
                Full name
                <input
                  required
                  autoComplete="name"
                  placeholder="e.g. Alex Morgan"
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                    })
                  }
                />
              </label>
            )}

            <label>
              Work email
              <input
                required
                type="email"
                autoComplete="username"
                placeholder="you@pharmacy.com"
                value={form.email}
                onChange={(e) =>
                  setForm({
                    ...form,
                    email: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Password
              <input
                required
                type="password"
                minLength="8"
                autoComplete={
                  mode === "login"
                    ? "current-password"
                    : "new-password"
                }
                placeholder="At least 8 characters"
                value={form.password}
                onChange={(e) =>
                  setForm({
                    ...form,
                    password: e.target.value,
                  })
                }
              />
            </label>

            {error && (
              <div className="form-error">
                <CircleAlert size={16} />
                {error}
              </div>
            )}

            <button
              className="button button-primary auth-submit"
              disabled={busy}
            >
              {busy
                ? "Please wait…"
                : mode === "setup"
                  ? "Create workspace"
                  : mode === "register"
                    ? "Create account"
                    : "Sign in"}

              <ArrowRight size={17} />
            </button>
          </form>

          {mode === "login" ? (
            <div className="auth-switch">
              Need an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                Create one
              </button>
            </div>
          ) : (
            <div className="auth-switch">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Sign in
              </button>
            </div>
          )}
        </div>

        <div className="auth-footnote">
          <ShieldCheck size={15} />
          Your data is protected and only accessible to your team.
        </div>
      </section>
    </main>
  );
}

// WORKSPACE
function Workspace({ token, user, onSignOut }) {
  const [section, setSection] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const reload = () => {
    setRefresh((value) => value + 1);
  };

  const currentLabel = navItems
    .flatMap((group) => group.items)
    .find((item) => item.id === section)?.label;

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="mobile-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside
        className={`sidebar ${
          sidebarOpen ? "sidebar-open" : ""
        }`}
      >
        <div className="sidebar-brand">
          <div className="brand-mark">
            <Activity size={21} />
          </div>

          <span>
            Medi<span>Stock</span>
          </span>

          <button
            className="icon-button mobile-close"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={19} />
          </button>
        </div>

        <div className="workspace-switch">
          <div className="workspace-avatar">
            <Store size={17} />
          </div>

          <div>
            <strong>Goodwell Pharmacy</strong>
            <small>Downtown branch</small>
          </div>

          <ChevronDown size={16} className="muted-icon" />
        </div>

        <nav className="sidebar-nav">
          {navItems.map((group) => (
            <div className="nav-group" key={group.title}>
              <div className="nav-heading">
                {group.title}
              </div>

              {group.items
                .filter(
                  (item) =>
                    !item.adminOnly || user.role === "admin"
                )
                .map(
                  ({ id, label, icon: Icon, badge }) => (
                    <button
                      key={id}
                      className={`nav-link ${
                        section === id ? "active" : ""
                      }`}
                      onClick={() => {
                        setSection(id);
                        setSidebarOpen(false);
                      }}
                    >
                      <Icon size={18} strokeWidth={1.8} />

                      <span>{label}</span>

                      {badge && (
                        <span className="nav-dot" />
                      )}
                    </button>
                  )
                )}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">
              <ShieldCheck size={17} />
            </div>

            <strong>All systems healthy</strong>
            <span>Your inventory is up to date.</span>
          </div>

          <button
            className="profile-button"
            onClick={onSignOut}
          >
            <div className="avatar">
              {(user.name || "A")
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>

            <div className="profile-meta">
              <strong>{user.name}</strong>

              <span>
                {user.role === "admin"
                  ? "Administrator"
                  : "Staff member"}
              </span>
            </div>

            <LogOut size={17} className="profile-exit" />
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="icon-button mobile-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div className="breadcrumb">
              Workspace
              <ChevronRight size={14} />
              <strong>{currentLabel}</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="today-label">
              <CalendarDays size={16} />

              {new Date().toLocaleDateString("en-IN", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </div>

            <button
              className="top-avatar"
              title={`${user.name} · ${user.role}`}
            >
              {(user.name || "A")[0].toUpperCase()}
            </button>
          </div>
        </header>

        {section === "dashboard" && (
          <Dashboard
            token={token}
            refresh={refresh}
            go={setSection}
            userName={user.name}
          />
        )}

        {section === "inventory" && (
          <Inventory
            token={token}
            refresh={refresh}
            reload={reload}
          />
        )}

        {section === "sales" && (
          <Sales
            token={token}
            refresh={refresh}
            reload={reload}
          />
        )}

        {section === "suppliers" && (
          <Suppliers token={token} refresh={refresh} />
        )}

        {section === "reports" && (
          <Reports token={token} refresh={refresh} />
        )}

        {section === "team" && user.role === "admin" && (
          <Team token={token} refresh={refresh} />
        )}
      </main>
    </div>
  );
}

// COMMON COMPONENTS
function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow page-eyebrow">
          {eyebrow}
        </div>

        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <div className="page-actions">
        {actions}
      </div>
    </div>
  );
}

function Button({
  children,
  variant = "primary",
  icon: Icon,
  ...props
}) {
  return (
    <button
      className={`button button-${variant}`}
      {...props}
    >
      {Icon && (
        <Icon size={17} strokeWidth={2} />
      )}

      {children}
    </button>
  );
}

function ErrorBanner({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="error-banner">
      <CircleAlert size={17} />

      <span>{message}</span>

      {onClose && (
        <button onClick={onClose}>
          <X size={16} />
        </button>
      )}
    </div>
  );
}

function EmptyState({
  icon: Icon = Package,
  title,
  text,
  action,
}) {
  return (
    <div className="empty-state">
      <div>
        <Icon size={23} />
      </div>

      <strong>{title}</strong>
      <span>{text}</span>

      {action}
    </div>
  );
}

// DASHBOARD
function Dashboard({ token, refresh, go, userName }) {
  const [data, setData] = useState(null);
  const [salesFallback, setSalesFallback] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      try {
        const dashboardResult = await request("/dashboard", { token });
        if (!active) return;
        setData(dashboardResult);
        setError("");

        // Some API versions return monthly buckets with a different shape.
        // Keep the sales list as a fallback so the chart can still be built
        // from real transactions instead of silently rendering six zeroes.
        try {
          const salesResult = await request("/sales", { token });
          if (active) setSalesFallback(salesResult.sales || []);
        } catch (salesError) {
          console.warn("Could not load sales for chart fallback:", salesError.message);
        }
      } catch (e) {
        if (active) setError(e.message);
      }
    };

    loadDashboard();
    return () => { active = false; };
  }, [token, refresh]);

  const chartData = useMemo(() => {
    const source = Array.isArray(data?.salesByMonth) ? data.salesByMonth : [];
    const monthRows = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - (5 - index));
      return date;
    });

    const getMonthKey = (item) => {
      const id = item?._id ?? item?.id ?? {};
      const year = Number(id?.year ?? item?.year);
      const month = Number(id?.month ?? item?.month);
      if (Number.isFinite(year) && year > 0 && Number.isFinite(month) && month >= 1 && month <= 12) {
        return `${year}-${month}`;
      }

      const dateValue = item?.monthStart ?? item?.date ?? item?.createdAt ?? (typeof id === "string" ? id : null);
      if (dateValue) {
        const parsed = new Date(dateValue);
        if (!Number.isNaN(parsed.getTime())) return `${parsed.getFullYear()}-${parsed.getMonth() + 1}`;
      }

      if (typeof id === "string") {
        const match = id.match(/^(\d{4})[-/](\d{1,2})$/);
        if (match) return `${Number(match[1])}-${Number(match[2])}`;
      }
      return null;
    };

    const getRevenue = (item) => {
      const value = item?.revenue ?? item?.totalRevenue ?? item?.total ?? item?.amount ?? 0;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const monthlyTotals = new Map();
    source.forEach((item) => {
      const key = getMonthKey(item);
      if (key) {
        monthlyTotals.set(key, (monthlyTotals.get(key) || 0) + getRevenue(item));
      }
    });

    // Fallback to real sale records if the monthly aggregation is absent,
    // has an unexpected shape, or contains no usable revenue values.
    const monthlySourceHasRevenue = [...monthlyTotals.values()].some((value) => value > 0);
    if (!monthlySourceHasRevenue && salesFallback.length) {
      monthlyTotals.clear();
      salesFallback.forEach((sale) => {
        const date = new Date(sale.createdAt || sale.date);
        if (Number.isNaN(date.getTime())) return;
        const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        monthlyTotals.set(key, (monthlyTotals.get(key) || 0) + getRevenue(sale));
      });
    }

    return monthRows.map((month) => {
      const key = `${month.getFullYear()}-${month.getMonth() + 1}`;
      const matchingRows = source.filter((item) => getMonthKey(item) === key);
      const sourceOrders = matchingRows.reduce((sum, item) => sum + Number(item.orders || item.count || 0), 0);
      const fallbackOrders = salesFallback.filter((sale) => {
        const date = new Date(sale.createdAt || sale.date);
        return !Number.isNaN(date.getTime()) && date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
      }).length;

      return {
        label: month.toLocaleDateString("en-IN", { month: "short" }),
        revenue: Number(monthlyTotals.get(key) || 0), // API/database amount remains USD here.
        orders: sourceOrders || fallbackOrders,
      };
    });
  }, [data, salesFallback]);

  const stats = data?.stats || {};

  const tiles = [
    {
      label: "Total products",
      value: stats.inventory ?? "—",
      meta: "Active in your catalog",
      icon: Boxes,
      tint: "mint",
      trend: "Inventory",
    },
    {
      label: "Revenue this month",
      value: money(stats.revenue),
      meta: `${stats.orders || 0} completed orders`,
      icon: CreditCard,
      tint: "blue",
      trend: "This month",
    },
    {
      label: "Low stock items",
      value: stats.lowStock ?? "—",
      meta: "Need a restock soon",
      icon: CircleAlert,
      tint: "amber",
      trend:
        stats.lowStock > 0
          ? "Needs attention"
          : "All clear",
    },
    {
      label: "Expiring soon",
      value: stats.expiring ?? "—",
      meta: "Within the next 90 days",
      icon: CalendarDays,
      tint: "rose",
      trend: "Next 90 days",
    },
  ];

  return (
    <div className="page-content">
      <PageHeader
        eyebrow={new Date()
          .toLocaleDateString("en-IN", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })
          .toUpperCase()}
        title={`${
          new Date().getHours() < 12
            ? "Good morning"
            : new Date().getHours() < 18
              ? "Good afternoon"
              : "Good evening"
        }, ${userName.split(" ")[0]}`}
        description="Here’s what’s happening at your pharmacy today."
        actions={
          <Button
            variant="light"
            icon={Download}
            onClick={() => go("reports")}
          >
            View reports
          </Button>
        }
      />

      {error && <ErrorBanner message={error} />}

      <div className="stat-grid">
        {tiles.map(
          ({
            label,
            value,
            meta,
            icon: Icon,
            tint,
            trend,
          }) => (
            <article className="stat-card" key={label}>
              <div className="stat-top">
                <div className={`stat-icon ${tint}`}>
                  <Icon size={18} />
                </div>

                <span className={`stat-trend ${tint}`}>
                  {trend}
                </span>
              </div>

              <div className="stat-value">{value}</div>
              <div className="stat-label">{label}</div>
              <div className="stat-meta">{meta}</div>
            </article>
          )
        )}
      </div>

      <div className="dashboard-grid">
        <section className="panel sales-chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Sales overview</h2>
              <p>
                Revenue performance over the last 6 months
              </p>
            </div>

            <span className="period-pill">
              <span />
              Last 6 months
              <ChevronDown size={14} />
            </span>
          </div>

          <div className="chart-legend">
            <span>
              <i className="legend-dot green" />
              Revenue
            </span>

            <strong>
              {money(
                chartData.reduce(
                  (sum, item) => sum + item.revenue,
                  0
                )
              )}

              <small> · 6 months</small>
            </strong>
          </div>

          <div className="sales-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 12, right: 12, left: 4, bottom: 4 }}
              >
                <defs>
                  <linearGradient
                    id="salesFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#279d78"
                      stopOpacity={0.19}
                    />

                    <stop
                      offset="100%"
                      stopColor="#279d78"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  vertical={false}
                  stroke="#edf1ef"
                />

                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#94a19b",
                    fontSize: 12,
                  }}
                  dy={11}
                />

                <YAxis
                  domain={[0, "auto"]}
                  allowDecimals={false}
                  tickCount={5}
                  width={64}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a19b", fontSize: 11 }}
                  tickFormatter={(value) => {
                    const inrValue = usdToInr(value);
                    return inrValue >= 100000
                      ? `₹${(inrValue / 100000).toFixed(1)}L`
                      : inrValue >= 1000
                        ? `₹${(inrValue / 1000).toFixed(1)}k`
                        : `₹${Math.round(inrValue)}`;
                  }}
                />

                <Tooltip
                  formatter={(value) => fullMoney(value)}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #e8eeeb",
                    boxShadow: "0 8px 24px #163b2817",
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  connectNulls
                  stroke="#279d78"
                  strokeWidth={2.5}
                  fill="url(#salesFill)"
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  dot={{ r: 3, fill: "#279d78", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel top-products-panel">
          <div className="panel-heading">
            <div>
              <h2>Top products</h2>
              <p>Your bestsellers by units sold</p>
            </div>

            <button
              className="text-button"
              onClick={() => go("inventory")}
            >
              View inventory
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="product-rank-list">
            {(data?.topMedicines || []).length ? (
              data.topMedicines.map((item, index) => (
                <div
                  className="product-rank"
                  key={item._id}
                >
                  <span
                    className={`rank-number rank-${index + 1}`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div className="product-letters">
                    {item._id.slice(0, 1)}
                  </div>

                  <div className="product-rank-info">
                    <strong>{item._id}</strong>
                    <span>{item.units} units sold</span>
                  </div>

                  <b>{money(item.revenue)}</b>
                </div>
              ))
            ) : (
              <div className="inline-empty">
                Sales activity will show your bestsellers here.
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="dashboard-grid lower-grid">
        <section className="panel table-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent sales</h2>
              <p>The latest activity from your store</p>
            </div>

            <button
              className="text-button"
              onClick={() => go("sales")}
            >
              All sales
              <ArrowRight size={14} />
            </button>
          </div>

          <SalesTable
            sales={data?.recentSales || []}
            compact
          />
        </section>

        <section className="panel alerts-panel">
          <div className="panel-heading">
            <div>
              <h2>Needs attention</h2>
              <p>A little heads-up for your team</p>
            </div>

            <Bell size={17} className="muted-icon" />
          </div>

          <div className="alert-group">
            <div className="alert-group-head">
              <div className="alert-heading-icon amber">
                <Package size={15} />
              </div>

              <strong>Running low</strong>

              <button
                className="alert-count"
                onClick={() => go("inventory")}
              >
                {stats.lowStock || 0}
              </button>
            </div>

            {(data?.lowStockItems || [])
              .slice(0, 3)
              .map((item) => (
                <div className="alert-row" key={item._id}>
                  <span>{item.name}</span>

                  <strong className="alert-quantity">
                    {item.quantity} {item.unit} left
                  </strong>
                </div>
              ))}

            {!data?.lowStockItems?.length && (
              <div className="alert-clear">
                <Check size={14} />
                Stock levels look good
              </div>
            )}
          </div>

          <div className="alert-group expiry-group">
            <div className="alert-group-head">
              <div className="alert-heading-icon rose">
                <CalendarDays size={15} />
              </div>

              <strong>Expiring soon</strong>

              <button
                className="alert-count rose-count"
                onClick={() => go("inventory")}
              >
                {stats.expiring || 0}
              </button>
            </div>

            {(data?.expiringItems || [])
              .slice(0, 2)
              .map((item) => (
                <div className="alert-row" key={item._id}>
                  <span>{item.name}</span>

                  <strong className="expiry-date">
                    {dateLabel(item.expiryDate, {
                      month: "short",
                      year: "numeric",
                    })}
                  </strong>
                </div>
              ))}

            {!data?.expiringItems?.length && (
              <div className="alert-clear">
                <Check size={14} />
                No upcoming expiry alerts
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// SALES TABLE
function SalesTable({ sales, compact = false }) {
  if (!sales.length) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="No sales just yet"
        text="Completed bills will appear here."
      />
    );
  }

  return (
    <div className="table-scroll">
      <table className={compact ? "compact-table" : ""}>
        <thead>
          <tr>
            <th>INVOICE</th>
            <th>CUSTOMER</th>
            <th>DATE</th>
            <th>PAYMENT</th>
            <th className="align-right">TOTAL</th>
          </tr>
        </thead>

        <tbody>
          {sales.map((sale) => (
            <tr key={sale._id}>
              <td>
                <span className="invoice-number">
                  {sale.invoiceNumber}
                </span>
              </td>

              <td>
                <span className="customer-cell">
                  {sale.customerName || "Walk-in customer"}
                </span>
              </td>

              <td>
                {dateLabel(sale.createdAt, {
                  month: "short",
                  day: "numeric",
                })}
              </td>

              <td>
                <span className="payment-tag">
                  {sale.paymentMethod}
                </span>
              </td>

              <td className="align-right">
                <strong>{money(sale.total)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// INVENTORY
function Inventory({ token, refresh, reload }) {
  const [medicines, setMedicines] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [status, setStatus] = useState("All items");
  const [modal, setModal] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();

      if (query) params.set("search", query);

      if (category !== "All categories") {
        params.set("category", category);
      }

      if (status !== "All items") {
        params.set("status", status);
      }

      const [medResult, supResult] = await Promise.all([
        request(`/medicines?${params}`, { token }),
        request("/suppliers", { token }),
      ]);

      setMedicines(medResult.medicines);
      setSuppliers(supResult.suppliers);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, query, category, status, refresh]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (form) => {
    try {
      await request(
        modal._id ? `/medicines/${modal._id}` : "/medicines",
        {
          token,
          method: modal._id ? "PUT" : "POST",
          body: JSON.stringify(form),
        }
      );

      setModal(null);
      reload();
    } catch (e) {
      setError(e.message);
      throw e;
    }
  };

  const remove = async (medicine) => {
    if (
      !window.confirm(
        `Delete ${medicine.name} from your inventory?`
      )
    ) {
      return;
    }

    try {
      await request(`/medicines/${medicine._id}`, {
        token,
        method: "DELETE",
      });

      reload();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="page-content">
      <PageHeader
        eyebrow="PRODUCT CATALOG"
        title="Inventory"
        description="Keep an eye on every product, batch, and expiry date."
        actions={
          <Button
            icon={Plus}
            onClick={() => setModal({})}
          >
            Add medicine
          </Button>
        }
      />

      <ErrorBanner
        message={error}
        onClose={() => setError("")}
      />

      <div className="inventory-summary">
        <div className="inventory-summary-copy">
          <div className="inventory-summary-icon">
            <Boxes size={20} />
          </div>

          <div>
            <strong>{medicines.length} products</strong>
            <span>across your medicine catalog</span>
          </div>
        </div>

        <div className="summary-separator" />

        <div className="summary-quick amber-quick">
          <CircleAlert size={16} />

          <span>
            <b>
              {
                medicines.filter(
                  (m) => m.quantity <= m.lowStockThreshold
                ).length
              }
            </b>
            {" "}low stock
          </span>
        </div>

        <div className="summary-quick rose-quick">
          <CalendarDays size={16} />

          <span>
            <b>
              {
                medicines.filter(
                  (m) =>
                    new Date(m.expiryDate) <=
                    new Date(Date.now() + 90 * 86400000)
                ).length
              }
            </b>
            {" "}expiring soon
          </span>
        </div>
      </div>

      <section className="panel inventory-panel">
        <div className="inventory-toolbar">
          <div className="search-box">
            <Search size={17} />

            <input
              placeholder="Search by name, brand, SKU…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <kbd>⌘ K</kbd>
          </div>

          <div className="toolbar-filters">
            <label className="select-wrap">
              <Filter size={15} />

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option>All categories</option>

                {MEDICINE_CATEGORIES.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>

              <ChevronDown size={14} />
            </label>

            <label className="select-wrap">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option>All items</option>
                <option>Low stock</option>
                <option>Expiring soon</option>
              </select>

              <ChevronDown size={14} />
            </label>
          </div>
        </div>

        {loading ? (
          <div className="loading-row">
            <span className="loader" />
            Loading inventory…
          </div>
        ) : medicines.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>MEDICINE</th>
                  <th>SKU / BATCH</th>
                  <th>CATEGORY</th>
                  <th>STOCK LEVEL</th>
                  <th>EXPIRY DATE</th>
                  <th>UNIT PRICE</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {medicines.map((medicine, index) => {
                  const low =
                    medicine.quantity <=
                    medicine.lowStockThreshold;

                  const expired =
                    new Date(medicine.expiryDate) < new Date();

                  const soon =
                    !expired &&
                    new Date(medicine.expiryDate) <=
                      new Date(Date.now() + 90 * 86400000);

                  return (
                    <tr key={medicine._id}>
                      <td>
                        <div className="medicine-cell">
                          <div
                            className={`medicine-symbol symbol-${index % 5}`}
                          >
                            {medicine.name.slice(0, 1)}
                          </div>

                          <div>
                            <strong>{medicine.name}</strong>
                            <span>{medicine.brand}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <strong className="sku-text">
                          {medicine.sku}
                        </strong>

                        <span className="sub-cell">
                          {medicine.batchNumber}
                        </span>
                      </td>

                      <td>
                        <span className="category-tag">
                          {medicine.category}
                        </span>
                      </td>

                      <td>
                        <div className="stock-cell">
                          <div className="stock-bar">
                            <span
                              className={
                                low ? "stock-low" : ""
                              }
                              style={{
                                width: `${
                                  Math.min(
                                    100,
                                    (medicine.quantity /
                                      Math.max(
                                        1,
                                        medicine.lowStockThreshold * 3
                                      )) *
                                      100
                                  )
                                }%`,
                              }}
                            />
                          </div>

                          <strong
                            className={
                              low ? "text-amber" : ""
                            }
                          >
                            {medicine.quantity}
                          </strong>

                          <span>{medicine.unit}</span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={
                            expired || soon
                              ? "expiry-warning"
                              : ""
                          }
                        >
                          {dateLabel(medicine.expiryDate, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>

                        {(expired || soon) && (
                          <span
                            className={`sub-cell ${
                              expired
                                ? "text-rose"
                                : "text-amber"
                            }`}
                          >
                            {expired
                              ? "Expired"
                              : "Expiring soon"}
                          </span>
                        )}
                      </td>

                      <td>
                        <strong>
                          {fullMoney(medicine.sellingPrice)}
                        </strong>
                      </td>

                      <td>
                        <div className="row-actions">
                          <button
                            title="Edit medicine"
                            onClick={() => setModal(medicine)}
                          >
                            <Settings2 size={16} />
                          </button>

                          <button
                            title="Delete medicine"
                            onClick={() => remove(medicine)}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No medicines found"
            text={
              query ||
              category !== "All categories" ||
              status !== "All items"
                ? "Try changing your search or filters."
                : "Add your first medicine to start tracking stock."
            }
            action={
              !medicines.length && !query ? (
                <Button
                  icon={Plus}
                  onClick={() => setModal({})}
                >
                  Add medicine
                </Button>
              ) : null
            }
          />
        )}

        <div className="table-footer">
          <span>
            Showing <strong>{medicines.length}</strong> products
          </span>

          <div className="pagination">
            <button disabled>
              <ChevronLeft size={16} />
            </button>

            <button className="selected">1</button>

            <button disabled>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {modal && (
        <MedicineModal
          medicine={modal}
          suppliers={suppliers}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

// MODAL
function Modal({
  title,
  description,
  onClose,
  children,
  wide = false,
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className={`modal ${wide ? "modal-wide" : ""}`}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>

          <button
            className="icon-button modal-close"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>

        {children}
      </section>
    </div>
  );
}

// MEDICINE MODAL
function MedicineModal({
  medicine,
  suppliers,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState({
    name: "",
    brand: "",
    sku: "",
    category: "Pain relief",
    batchNumber: "",
    quantity: 0,
    lowStockThreshold: 10,
    costPrice: "",
    sellingPrice: "",
    unit: "units",
    supplier: "",
    ...medicine,
    costPrice:
      medicine.costPrice != null
        ? usdToInr(medicine.costPrice).toFixed(2)
        : "",
    sellingPrice:
      medicine.sellingPrice != null
        ? usdToInr(medicine.sellingPrice).toFixed(2)
        : "",
    expiryDate: medicine.expiryDate
      ? new Date(medicine.expiryDate)
          .toISOString()
          .slice(0, 10)
      : "",
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();

    setBusy(true);
    setError("");

    try {
      await onSave({
        ...form,
        quantity: Number(form.quantity),
        lowStockThreshold: Number(form.lowStockThreshold),
        costPrice: inrToUsd(form.costPrice),
        sellingPrice: inrToUsd(form.sellingPrice),
        supplier:
          form.supplier?._id ||
          form.supplier ||
          null,
      });
    } catch (issue) {
      setError(issue.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={medicine._id ? "Edit medicine" : "Add a medicine"}
      description="Add the details your team needs to keep stock moving."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="span-two">
            Medicine name

            <input
              required
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value,
                })
              }
              placeholder="e.g. Vitamin C 500mg"
            />
          </label>

          <label>
            Brand

            <input
              required
              value={form.brand}
              onChange={(e) =>
                setForm({
                  ...form,
                  brand: e.target.value,
                })
              }
              placeholder="Brand name"
            />
          </label>

          <label>
            Category

            <select
              required
              value={form.category}
              onChange={(e) =>
                setForm({
                  ...form,
                  category: e.target.value,
                })
              }
            >
              {MEDICINE_CATEGORIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            SKU

            <input
              required
              value={form.sku}
              onChange={(e) =>
                setForm({
                  ...form,
                  sku: e.target.value,
                })
              }
              placeholder="MED-001"
            />
          </label>

          <label>
            Batch number

            <input
              required
              value={form.batchNumber}
              onChange={(e) =>
                setForm({
                  ...form,
                  batchNumber: e.target.value,
                })
              }
              placeholder="B-2026-001"
            />
          </label>

          <label>
            Quantity in stock

            <input
              type="number"
              min="0"
              required
              value={form.quantity}
              onChange={(e) =>
                setForm({
                  ...form,
                  quantity: e.target.value,
                })
              }
            />
          </label>

          <label>
            Low stock threshold

            <input
              type="number"
              min="0"
              required
              value={form.lowStockThreshold}
              onChange={(e) =>
                setForm({
                  ...form,
                  lowStockThreshold: e.target.value,
                })
              }
            />
          </label>

          <label>
            Cost price (₹)

            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.costPrice}
              onChange={(e) =>
                setForm({
                  ...form,
                  costPrice: e.target.value,
                })
              }
              placeholder="0.00"
            />
          </label>

          <label>
            Selling price (₹)

            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.sellingPrice}
              onChange={(e) =>
                setForm({
                  ...form,
                  sellingPrice: e.target.value,
                })
              }
              placeholder="0.00"
            />
          </label>

          <label>
            Expiry date

            <input
              type="date"
              required
              value={form.expiryDate}
              onChange={(e) =>
                setForm({
                  ...form,
                  expiryDate: e.target.value,
                })
              }
            />
          </label>

          <label>
            Supplier

            <select
              value={form.supplier?._id || form.supplier || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  supplier: e.target.value,
                })
              }
            >
              <option value="">No supplier</option>

              {suppliers.map((supplier) => (
                <option
                  key={supplier._id}
                  value={supplier._id}
                >
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ErrorBanner message={error} />

        <div className="modal-actions">
          <Button
            type="button"
            variant="light"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button disabled={busy}>
            {busy
              ? "Saving…"
              : medicine._id
                ? "Save changes"
                : "Add medicine"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// SALES
function Sales({ token, refresh, reload }) {
  const [sales, setSales] = useState([]);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);

      const params = new URLSearchParams();

      if (query) params.set("search", query);

      request(`/sales?${params}`, { token })
        .then((result) => {
          setSales(result.sales);
          setError("");
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 200);

    return () => clearTimeout(timer);
  }, [token, query, refresh]);

  const save = async (payload) => {
    try {
      await request("/sales", {
        token,
        method: "POST",
        body: JSON.stringify(payload),
      });

      setModal(false);
      reload();
    } catch (e) {
      setError(e.message);
      throw e;
    }
  };

  const total = sales.reduce(
    (sum, sale) => sum + sale.total,
    0
  );

  return (
    <div className="page-content">
      <PageHeader
        eyebrow="CHECKOUT & TRANSACTIONS"
        title="Sales & billing"
        description="A clear view of every order, payment, and customer."
        actions={
          <Button
            icon={Plus}
            onClick={() => setModal(true)}
          >
            Create a bill
          </Button>
        }
      />

      <ErrorBanner
        message={error}
        onClose={() => setError("")}
      />

      <div className="sales-summary-strip">
        <div>
          <span>Transactions shown</span>
          <strong>{sales.length}</strong>
        </div>

        <div>
          <span>Revenue shown</span>
          <strong>{money(total)}</strong>
        </div>

        <div>
          <span>Average order</span>
          <strong>
            {money(
              sales.length ? total / sales.length : 0
            )}
          </strong>
        </div>

        <div className="sales-summary-illustration">
          <ShoppingBag
            size={43}
            strokeWidth={1.15}
          />
        </div>
      </div>

      <section className="panel inventory-panel sales-list-panel">
        <div className="list-toolbar">
          <div>
            <h2>Recent transactions</h2>
            <p>Your most recent customer orders</p>
          </div>

          <div className="search-box sales-search">
            <Search size={17} />

            <input
              placeholder="Search invoice or customer…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="loading-row">
            <span className="loader" />
            Loading sales…
          </div>
        ) : (
          <SalesTable sales={sales} />
        )}

        <div className="table-footer">
          <span>
            Showing <strong>{sales.length}</strong> transactions
          </span>

          <span className="data-note">
            <ShieldCheck size={14} />
            Sales data is securely stored
          </span>
        </div>
      </section>

      {modal && (
        <BillModal
          token={token}
          onClose={() => setModal(false)}
          onSave={save}
        />
      )}
    </div>
  );
}

// BILL MODAL
function BillModal({ token, onClose, onSave }) {
  const [medicines, setMedicines] = useState([]);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [discount, setDiscount] = useState(0);
  const [cart, setCart] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    request("/medicines", { token })
      .then((data) =>
        setMedicines(
          data.medicines.filter((item) => item.quantity > 0)
        )
      )
      .catch((e) => setError(e.message));
  }, [token]);

  const addItem = (id) => {
    if (!id) return;

    const medicine = medicines.find(
      (item) => item._id === id
    );

    setCart((items) => {
      const current = items.find(
        (item) => item.medicine === id
      );

      if (current) {
        return items.map((item) =>
          item.medicine === id
            ? {
                ...item,
                quantity: Math.min(
                  item.quantity + 1,
                  medicine.quantity
                ),
              }
            : item
        );
      }

      return [
        ...items,
        {
          medicine: id,
          quantity: 1,
        },
      ];
    });
  };

  const subtotal = cart.reduce((total, item) => {
    const medicine = medicines.find(
      (medicine) => medicine._id === item.medicine
    );

    return (
      total +
      (medicine?.sellingPrice || 0) * item.quantity
    );
  }, 0);

  const submit = async (e) => {
    e.preventDefault();

    if (!cart.length) {
      return setError(
        "Add at least one medicine to this bill."
      );
    }

    setBusy(true);
    setError("");

    try {
      await onSave({
        customerName,
        paymentMethod,
        discount: inrToUsd(discount),
        items: cart,
      });
    } catch (issue) {
      setError(issue.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Create a bill"
      description="Build a customer order and update your stock automatically."
      onClose={onClose}
      wide
    >
      <form
        className="modal-form bill-form"
        onSubmit={submit}
      >
        <div className="bill-customer-row">
          <label>
            Customer name
            <span className="optional-text">
              · optional
            </span>

            <input
              value={customerName}
              onChange={(e) =>
                setCustomerName(e.target.value)
              }
              placeholder="Walk-in customer"
            />
          </label>

          <label>
            Payment method

            <select
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value)
              }
            >
              <option>Cash</option>
              <option>Card</option>
              <option>UPI</option>
            </select>
          </label>
        </div>

        <label className="add-product-select">
          Add a product

          <select
            value=""
            onChange={(e) => addItem(e.target.value)}
          >
            <option value="">
              Select a medicine to add…
            </option>

            {medicines.map((medicine) => (
              <option
                key={medicine._id}
                value={medicine._id}
              >
                {medicine.name} · {medicine.quantity} in stock
                {" · "}
                {fullMoney(medicine.sellingPrice)}
              </option>
            ))}
          </select>
        </label>

        {cart.length ? (
          <div className="bill-items">
            {cart.map((item) => {
              const medicine = medicines.find(
                (entry) => entry._id === item.medicine
              );

              return (
                <div
                  className="bill-item"
                  key={item.medicine}
                >
                  <div className="bill-item-symbol">
                    <Package size={17} />
                  </div>

                  <div className="bill-item-name">
                    <strong>{medicine?.name}</strong>

                    <span>
                      {medicine?.sku} ·{" "}
                      {fullMoney(medicine?.sellingPrice)} each
                    </span>
                  </div>

                  <div className="quantity-control">
                    <button
                      type="button"
                      onClick={() =>
                        setCart((items) =>
                          items.map((entry) =>
                            entry.medicine === item.medicine
                              ? {
                                  ...entry,
                                  quantity: Math.max(
                                    1,
                                    entry.quantity - 1
                                  ),
                                }
                              : entry
                          )
                        )
                      }
                    >
                      −
                    </button>

                    <strong>{item.quantity}</strong>

                    <button
                      type="button"
                      onClick={() =>
                        setCart((items) =>
                          items.map((entry) =>
                            entry.medicine === item.medicine
                              ? {
                                  ...entry,
                                  quantity: Math.min(
                                    entry.quantity + 1,
                                    medicine.quantity
                                  ),
                                }
                              : entry
                          )
                        )
                      }
                      disabled={
                        item.quantity >= medicine.quantity
                      }
                    >
                      +
                    </button>
                  </div>

                  <strong className="bill-item-total">
                    {fullMoney(
                      medicine?.sellingPrice * item.quantity
                    )}
                  </strong>

                  <button
                    type="button"
                    className="remove-item"
                    onClick={() =>
                      setCart((items) =>
                        items.filter(
                          (entry) =>
                            entry.medicine !== item.medicine
                        )
                      )
                    }
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bill-empty">
            <ShoppingCart size={21} />

            <span>
              Your bill is empty. Choose a medicine above to
              get started.
            </span>
          </div>
        )}

        <div className="bill-bottom">
          <div className="bill-discount">
            <label>
              Discount
              <span className="optional-text">
                · optional
              </span>

              <div className="discount-field">
                <span>₹</span>

                <input
                  type="number"
                  min="0"
                  max={usdToInr(subtotal)}
                  step="0.01"
                  value={discount}
                  onChange={(e) =>
                    setDiscount(e.target.value)
                  }
                />
              </div>
            </label>
          </div>

          <div className="bill-totals">
            <div>
              <span>Subtotal</span>
              <strong>{fullMoney(subtotal)}</strong>
            </div>

            <div>
              <span>Discount</span>
              <strong>
                − {formatInr(discount, 2)}
              </strong>
            </div>

            <div className="bill-grand-total">
              <span>Total due</span>

              <strong>
                {fullMoney(
                  Math.max(
                    0,
                    subtotal - inrToUsd(discount)
                  )
                )}
              </strong>
            </div>
          </div>
        </div>

        <ErrorBanner message={error} />

        <div className="modal-actions">
          <Button
            type="button"
            variant="light"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button disabled={busy || cart.length === 0}>
            {busy ? "Completing sale…" : "Complete sale"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// SUPPLIERS
function Suppliers({ token, refresh }) {
  const [suppliers, setSuppliers] = useState([]);
  const [medicineList, setMedicineList] = useState([]);
  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [sup, meds] = await Promise.all([
        request("/suppliers", { token }),
        request("/medicines", { token }),
      ]);

      setSuppliers(sup.suppliers);
      setMedicineList(meds.medicines);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, refresh]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = suppliers.filter((supplier) =>
    `${supplier.name} ${supplier.contactPerson} ${supplier.email}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  const save = async (form) => {
    try {
      await request(
        modal._id
          ? `/suppliers/${modal._id}`
          : "/suppliers",
        {
          token,
          method: modal._id ? "PUT" : "POST",
          body: JSON.stringify(form),
        }
      );

      setModal(null);
      load();
    } catch (e) {
      setError(e.message);
      throw e;
    }
  };

  const remove = async (supplier) => {
    if (
      !window.confirm(
        `Delete supplier ${supplier.name}?`
      )
    ) {
      return;
    }

    try {
      await request(`/suppliers/${supplier._id}`, {
        token,
        method: "DELETE",
      });

      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="page-content">
      <PageHeader
        eyebrow="PARTNERS & PROCUREMENT"
        title="Suppliers"
        description="Good partnerships make the whole pharmacy run better."
        actions={
          <Button
            icon={Plus}
            onClick={() => setModal({})}
          >
            Add supplier
          </Button>
        }
      />

      <ErrorBanner
        message={error}
        onClose={() => setError("")}
      />

      <div className="supplier-highlight">
        <div className="supplier-highlight-icon">
          <Truck size={24} />
        </div>

        <div>
          <strong>Your partner network</strong>
          <span>
            Stay connected with your medicine distributors
            and suppliers.
          </span>
        </div>

        <div className="supplier-highlight-total">
          <strong>{suppliers.length}</strong>
          <span>trusted partners</span>
        </div>

        <div className="supplier-doodle">
          <Users size={42} strokeWidth={1.2} />
        </div>
      </div>

      <div className="supplier-toolbar">
        <div>
          <h2>
            Your suppliers <span>{filtered.length}</span>
          </h2>

          <p>Contact details and catalog coverage</p>
        </div>

        <div className="search-box">
          <Search size={17} />

          <input
            placeholder="Search suppliers…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-row panel">
          <span className="loader" />
          Loading suppliers…
        </div>
      ) : filtered.length ? (
        <div className="supplier-grid">
          {filtered.map((supplier, index) => {
            const count = medicineList.filter(
              (medicine) =>
                (medicine.supplier?._id ||
                  medicine.supplier) === supplier._id
            ).length;

            return (
              <article
                className="supplier-card"
                key={supplier._id}
              >
                <div className="supplier-card-top">
                  <div
                    className={`supplier-logo logo-${index % 5}`}
                  >
                    {supplier.name.slice(0, 1).toUpperCase()}
                  </div>

                  <button
                    className="more-button"
                    onClick={() => setModal(supplier)}
                    aria-label={`Edit ${supplier.name}`}
                  >
                    <MoreHorizontal size={20} />
                  </button>
                </div>

                <h3>{supplier.name}</h3>

                <div className="supplier-contact">
                  <UserRound size={15} />
                  <span>
                    {supplier.contactPerson ||
                      "Contact not provided"}
                  </span>
                </div>

                {supplier.email && (
                  <div className="supplier-contact">
                    <Activity size={15} />
                    <span>{supplier.email}</span>
                  </div>
                )}

                {supplier.phone && (
                  <div className="supplier-contact">
                    <CreditCard size={15} />
                    <span>{supplier.phone}</span>
                  </div>
                )}

                <div className="supplier-card-footer">
                  <span className="coverage-tag">
                    <Package size={14} />
                    {count}{" "}
                    {count === 1 ? "product" : "products"}
                  </span>

                  <button
                    className="supplier-remove"
                    onClick={() => remove(supplier)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Truck}
          title="No suppliers found"
          text={
            query
              ? "Try another search."
              : "Add your first supplier to keep supplier details in one place."
          }
          action={
            !query ? (
              <Button
                icon={Plus}
                onClick={() => setModal({})}
              >
                Add supplier
              </Button>
            ) : null
          }
        />
      )}

      {modal && (
        <SupplierModal
          supplier={modal}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

// SUPPLIER MODAL
function SupplierModal({
  supplier,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState({
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    ...supplier,
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();

    setBusy(true);
    setError("");

    try {
      await onSave(form);
    } catch (issue) {
      setError(issue.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={
        supplier._id
          ? "Edit supplier"
          : "Add a supplier"
      }
      description="Save reliable contact details for your supply partners."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="span-two">
            Supplier name

            <input
              required
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value,
                })
              }
              placeholder="e.g. Northstar Pharmaceuticals"
            />
          </label>

          <label>
            Contact person

            <input
              value={form.contactPerson}
              onChange={(e) =>
                setForm({
                  ...form,
                  contactPerson: e.target.value,
                })
              }
              placeholder="Full name"
            />
          </label>

          <label>
            Phone number

            <input
              type="tel"
              value={form.phone}
              onChange={(e) =>
                setForm({
                  ...form,
                  phone: e.target.value,
                })
              }
              placeholder="+91 00000 00000"
            />
          </label>

          <label className="span-two">
            Email address

            <input
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm({
                  ...form,
                  email: e.target.value,
                })
              }
              placeholder="supplier@example.com"
            />
          </label>

          <label className="span-two">
            Business address

            <textarea
              rows="2"
              value={form.address}
              onChange={(e) =>
                setForm({
                  ...form,
                  address: e.target.value,
                })
              }
              placeholder="Street, city, postal code"
            />
          </label>
        </div>

        <ErrorBanner message={error} />

        <div className="modal-actions">
          <Button
            type="button"
            variant="light"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button disabled={busy}>
            {busy
              ? "Saving…"
              : supplier._id
                ? "Save changes"
                : "Add supplier"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// TEAM
function Team({ token, refresh }) {
  const [staff, setStaff] = useState([]);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const result = await request("/auth/staff", {
        token,
      });

      setStaff(result.staff);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, refresh]);

  useEffect(() => {
    load();
  }, [load]);

  const addStaff = async (form) => {
    try {
      await request("/auth/staff", {
        token,
        method: "POST",
        body: JSON.stringify(form),
      });

      setModal(false);
      load();
    } catch (e) {
      setError(e.message);
      throw e;
    }
  };

  return (
    <div className="page-content">
      <PageHeader
        eyebrow="PEOPLE & PERMISSIONS"
        title="Your team"
        description="Give the right people secure access to your pharmacy."
        actions={
          <Button
            icon={Plus}
            onClick={() => setModal(true)}
          >
            Add team member
          </Button>
        }
      />

      <ErrorBanner
        message={error}
        onClose={() => setError("")}
      />

      <div className="supplier-highlight team-highlight">
        <div className="supplier-highlight-icon">
          <Users size={23} />
        </div>

        <div>
          <strong>A team that cares</strong>
          <span>
            Each teammate gets their own secure sign-in to
            MediStock.
          </span>
        </div>

        <div className="supplier-highlight-total">
          <strong>{staff.length}</strong>
          <span>team members</span>
        </div>
      </div>

      <div className="supplier-toolbar">
        <div>
          <h2>
            Workspace access <span>{staff.length}</span>
          </h2>

          <p>
            Administrators and staff with access to this pharmacy
          </p>
        </div>
      </div>

      {loading ? (
        <div className="loading-row panel">
          <span className="loader" />
          Loading team…
        </div>
      ) : staff.length ? (
        <div className="team-list panel">
          {staff.map((member, index) => (
            <div
              className="team-member"
              key={member._id}
            >
              <div
                className={`team-avatar team-avatar-${index % 5}`}
              >
                {member.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              <div className="team-member-info">
                <strong>{member.name}</strong>
                <span>{member.email}</span>
              </div>

              <span
                className={`role-pill ${member.role}`}
              >
                {member.role === "admin" ? (
                  <ShieldCheck size={13} />
                ) : (
                  <UserRound size={13} />
                )}

                {member.role === "admin"
                  ? "Administrator"
                  : "Staff"}
              </span>

              <span className="team-joined">
                Joined{" "}
                {dateLabel(member.createdAt, {
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="Your team will show up here"
          text="Add a staff member so they can sign in to MediStock."
          action={
            <Button
              icon={Plus}
              onClick={() => setModal(true)}
            >
              Add team member
            </Button>
          }
        />
      )}

      {modal && (
        <StaffModal
          onClose={() => setModal(false)}
          onSave={addStaff}
        />
      )}
    </div>
  );
}

// STAFF MODAL
function StaffModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "staff",
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();

    setBusy(true);
    setError("");

    try {
      await onSave(form);
    } catch (issue) {
      setError(issue.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Add a team member"
      description="Create a secure login for someone on your pharmacy team."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="span-two">
            Full name

            <input
              required
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value,
                })
              }
              placeholder="e.g. Taylor Rivera"
            />
          </label>

          <label className="span-two">
            Work email

            <input
              required
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm({
                  ...form,
                  email: e.target.value,
                })
              }
              placeholder="teammate@pharmacy.com"
            />
          </label>

          <label className="span-two">
            Temporary password

            <input
              required
              type="password"
              minLength="8"
              value={form.password}
              onChange={(e) =>
                setForm({
                  ...form,
                  password: e.target.value,
                })
              }
              placeholder="At least 8 characters"
            />
          </label>

          <label className="span-two">
            Access level

            <select
              value={form.role}
              onChange={(e) =>
                setForm({
                  ...form,
                  role: e.target.value,
                })
              }
            >
              <option value="staff">
                Staff — inventory and day-to-day operations
              </option>

              <option value="admin">
                Administrator — full workspace access
              </option>
            </select>
          </label>
        </div>

        <ErrorBanner message={error} />

        <div className="modal-actions">
          <Button
            type="button"
            variant="light"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button disabled={busy}>
            {busy
              ? "Creating account…"
              : "Create account"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// REPORTS
function Reports({ token, refresh }) {
  const currentMonth = new Date();

  const initialFrom = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() - 5,
    1
  )
    .toISOString()
    .slice(0, 10);

  const [from, setFrom] = useState(initialFrom);

  const [to, setTo] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({
      from,
      to,
    });

    request(`/reports?${params}`, { token })
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [token, from, to, refresh]);

  const chartData =
    data?.salesByDay?.map((row) => ({
      ...row,
      label: new Date(`${row._id}T12:00:00`).toLocaleDateString(
        "en-IN",
        {
          month: "short",
          day: "numeric",
        }
      ),
    })) || [];

  const maxRevenue = Math.max(
    1,
    ...(data?.topMedicines || []).map(
      (item) => item.revenue
    )
  );

  const downloadCsv = () => {
    const rows = [
      ["Date", "Orders", "Revenue (INR)"],
      ...(data?.salesByDay || []).map((row) => [
        row._id,
        row.orders,
        usdToInr(row.revenue).toFixed(2),
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map(
            (cell) =>
              `"${String(cell).replaceAll('"', '""')}"`
          )
          .join(",")
      )
      .join("\n");

    const link = document.createElement("a");

    link.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv" })
    );

    link.download = "medistock-sales-report.csv";
    link.click();

    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="page-content">
      <PageHeader
        eyebrow="PERFORMANCE & GROWTH"
        title="Reports"
        description="Make thoughtful decisions with a clear picture of sales."
        actions={
          <Button
            variant="light"
            icon={Download}
            onClick={downloadCsv}
          >
            Export report
          </Button>
        }
      />

      <ErrorBanner message={error} />

      <div className="report-date-filter">
        <div className="report-filter-copy">
          <div className="report-filter-icon">
            <CalendarDays size={18} />
          </div>

          <div>
            <strong>Report period</strong>
            <span>Choose a date range to explore</span>
          </div>
        </div>

        <label>
          From

          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>

        <ArrowRight
          size={16}
          className="date-arrow"
        />

        <label>
          To

          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>

      <div className="report-stats-grid">
        <ReportStat
          label="Total revenue"
          value={money(data?.summary?.revenue)}
          icon={CreditCard}
          tint="mint"
        />

        <ReportStat
          label="Orders completed"
          value={data?.summary?.orders ?? "—"}
          icon={ShoppingBag}
          tint="blue"
        />

        <ReportStat
          label="Average order value"
          value={money(data?.summary?.averageOrder)}
          icon={Activity}
          tint="amber"
        />
      </div>

      <div className="dashboard-grid report-grid">
        <section className="panel report-chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Revenue over time</h2>
              <p>
                Daily sales performance for your selected period
              </p>
            </div>

            <span className="report-chart-total">
              {money(data?.summary?.revenue)}
            </span>
          </div>

          <div className="report-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{
                  top: 12,
                  right: 2,
                  left: -18,
                  bottom: 0,
                }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#edf1ef"
                />

                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#94a19b",
                    fontSize: 11,
                  }}
                  interval="preserveStartEnd"
                  dy={9}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: "#94a19b",
                    fontSize: 11,
                  }}
                  tickFormatter={(value) => {
                    const inrValue = usdToInr(value);
                    return inrValue >= 100000
                      ? `₹${(inrValue / 100000).toFixed(1)}L`
                      : inrValue >= 1000
                        ? `₹${(inrValue / 1000).toFixed(1)}k`
                        : `₹${Math.round(inrValue)}`;
                  }}
                />

                <Tooltip
                  formatter={(value) => fullMoney(value)}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #e8eeeb",
                  }}
                />

                <Bar
                  dataKey="revenue"
                  fill="#299c78"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel bestsellers-panel">
          <div className="panel-heading">
            <div>
              <h2>Bestselling products</h2>
              <p>Revenue by medicine</p>
            </div>

            <ShoppingBag
              size={18}
              className="muted-icon"
            />
          </div>

          {(data?.topMedicines || []).length ? (
            <div className="bestseller-list">
              {data.topMedicines
                .slice(0, 6)
                .map((item, index) => (
                  <div
                    className="bestseller-item"
                    key={item._id}
                  >
                    <div className="bestseller-head">
                      <div>
                        <span className="bestseller-rank">
                          {String(index + 1).padStart(2, "0")}
                        </span>

                        <strong>{item._id}</strong>
                      </div>

                      <b>{money(item.revenue)}</b>
                    </div>

                    <div className="bestseller-bar">
                      <span
                        style={{
                          width: `${
                            Math.max(
                              3,
                              (item.revenue / maxRevenue) * 100
                            )
                          }%`,
                        }}
                      />
                    </div>

                    <span className="bestseller-units">
                      {item.units} units sold
                    </span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="inline-empty report-empty">
              No sales data for this period yet.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// REPORT STAT
function ReportStat({
  label,
  value,
  icon: Icon,
  tint,
}) {
  return (
    <article className="report-stat">
      <div className={`stat-icon ${tint}`}>
        <Icon size={18} />
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

export default App;
