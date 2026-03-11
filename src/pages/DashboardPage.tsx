import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "../services/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type RevenueSummary = {
  pending_revenue: number;
  checked_revenue: number;
  packing_shipping_revenue: number;
  success_revenue: number;
  fail_return_revenue: number;
  total_revenue: number;
};

type RevenueByDateItem = {
  date: string;
  pending_revenue: number;
  checked_revenue: number;
  packing_shipping_revenue: number;
  success_revenue: number;
  fail_return_revenue: number;
  total_revenue: number;
};

type SeriesKey =
  | "all"
  | "pending"
  | "checked"
  | "packing_shipping"
  | "success"
  | "fail_return";

function getUserRole(): string {
  try {
    const token = localStorage.getItem("token");
    if (!token) return "";
    const payload = JSON.parse(atob(token.split(".")[1]));
    return (payload?.role as string) ?? "";
  } catch {
    return "";
  }
}

const CARD_KEYS: { key: SeriesKey; label: string; dataKey: keyof RevenueByDateItem }[] = [
  { key: "all", label: "Total", dataKey: "total_revenue" },
  { key: "pending", label: "⌛ Pending", dataKey: "pending_revenue" },
  { key: "checked", label: "✅ Checked", dataKey: "checked_revenue" },
  { key: "packing_shipping", label: "📦 Packing + 🚚 Shipped", dataKey: "packing_shipping_revenue" },
  { key: "success", label: "✅ Success", dataKey: "success_revenue" },
  { key: "fail_return", label: "❌ Fail + Return", dataKey: "fail_return_revenue" },
];

export default function DashboardPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [series, setSeries] = useState<RevenueByDateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [selectedCard, setSelectedCard] = useState<SeriesKey>("all");

  const role = getUserRole();
  const canAccess = role === "manager" || role === "account";

  const fetchData = (from?: string, to?: string) => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = {};
    if (from?.trim()) params.created_from = from.trim();
    if (to?.trim()) params.created_to = to.trim();
    const reqSummary = api.get<RevenueSummary>("/orders/revenue-summary", { params });
    const reqSeries = api.get<{ series: RevenueByDateItem[] }>("/orders/revenue-by-date", { params });
    Promise.all([reqSummary, reqSeries])
      .then(([resS, resD]) => {
        setSummary(resS.data);
        setSeries(Array.isArray(resD.data?.series) ? resD.data.series : []);
        setAppliedFrom(from ?? "");
        setAppliedTo(to ?? "");
      })
      .catch(() => setError("Failed to load revenue data."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!canAccess) return;
    fetchData();
  }, [canAccess]);

  const handleApplyRange = () => {
    fetchData(dateFrom || undefined, dateTo || undefined);
  };

  const handleAllTime = () => {
    setDateFrom("");
    setDateTo("");
    fetchData();
  };

  if (!localStorage.getItem("token")) return <Navigate to="/login" replace />;
  if (!canAccess) {
    return (
      <div style={{ padding: 24, maxWidth: 600, margin: "0 auto", color: "#eee" }}>
        <p style={{ color: "#f59e0b" }}>Only Manager or Accountant can access the dashboard.</p>
        <Link to="/menu" style={{ color: "#60a5fa" }}>← Back to Menu</Link>
      </div>
    );
  }

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    padding: 24,
    background: "#1a1a1a",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#eee",
  };

  const cardBase: React.CSSProperties = {
    padding: 16,
    background: "#252525",
    border: "1px solid #333",
    borderRadius: 12,
    cursor: "pointer",
    transition: "border-color 0.2s, background 0.2s",
  };

  const labelStyle: React.CSSProperties = { fontSize: 12, color: "#9ca3af", marginBottom: 4 };
  const valueStyle: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: "#fff" };

  const formatBath = (n: number) =>
    `฿${n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const chartDataKey = selectedCard === "all" ? "total_revenue" : CARD_KEYS.find((c) => c.key === selectedCard)?.dataKey ?? "total_revenue";

  return (
    <div style={pageStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 24 }}>Dashboard — Revenue by status</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Link
            to="/orders"
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "1px solid #555",
              background: "#333",
              color: "#eee",
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            ← Order List
          </Link>
          <Link
            to="/menu"
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "1px solid #555",
              background: "#333",
              color: "#eee",
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            Menu
          </Link>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: "#aaa", fontSize: 14 }}>Order created date:</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #555",
            background: "#252525",
            color: "#eee",
            fontSize: 14,
          }}
        />
        <span style={{ color: "#888" }}>–</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #555",
            background: "#252525",
            color: "#eee",
            fontSize: 14,
          }}
        />
        <button
          type="button"
          onClick={handleApplyRange}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Apply range
        </button>
        <button
          type="button"
          onClick={handleAllTime}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid #555",
            background: "#333",
            color: "#eee",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          All time
        </button>
        {(appliedFrom || appliedTo) && (
          <span style={{ fontSize: 13, color: "#9ca3af" }}>
            {appliedFrom || "…"} – {appliedTo || "…"}
          </span>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            background: "#3b0000",
            color: "#fcc",
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: "#888" }}>Loading…</p>
      ) : summary ? (
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Left: vertical cards */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              minWidth: 220,
            }}
          >
            {CARD_KEYS.map(({ key, label, dataKey }) => {
              const value =
                key === "all"
                  ? summary.total_revenue
                  : summary[dataKey as keyof RevenueSummary] ?? 0;
              const isSelected = selectedCard === key;
              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedCard(key)}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedCard(key)}
                  style={{
                    ...cardBase,
                    borderColor: isSelected ? "#2563eb" : "#333",
                    background: isSelected ? "#1e3a5f" : "#252525",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ ...labelStyle, marginBottom: 0 }}>{label}</span>
                    <span style={valueStyle}>{formatBath(value)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: chart */}
          <div
            style={{
              flex: 1,
              minWidth: 400,
              height: 400,
              background: "#252525",
              border: "1px solid #333",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 14, color: "#9ca3af", marginBottom: 8 }}>
              Revenue by date
              {selectedCard !== "all" && ` — ${CARD_KEYS.find((c) => c.key === selectedCard)?.label}`}
            </div>
            {series.length === 0 ? (
              <p style={{ color: "#666", padding: 24 }}>No data in range</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart
                  data={series}
                  margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#888" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#888" tick={{ fontSize: 11 }} tickFormatter={(v) => `฿${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "#1a1a1a", border: "1px solid #444" }}
                    labelStyle={{ color: "#eee" }}
                    formatter={(value: unknown) => [formatBath(Number(value ?? 0)), chartDataKey.replace(/_/g, " ")]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey={chartDataKey}
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ fill: "#2563eb", r: 3 }}
                    name={chartDataKey.replace(/_/g, " ")}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
