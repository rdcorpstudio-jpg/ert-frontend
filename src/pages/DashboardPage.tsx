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
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type RevenueSummary = {
  pending_revenue: number;
  checked_revenue: number;
  packing_shipping_revenue: number;
  success_revenue: number;
  fail_return_revenue: number;
  total_revenue: number;
  pending_product_count: number;
  checked_product_count: number;
  packing_shipping_product_count: number;
  success_product_count: number;
  fail_return_product_count: number;
  total_product_count: number;
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

type RevenueByProductItem = { name: string; revenue: number };

type ShippingPaymentBucketRow = {
  key: string;
  label: string;
  revenue: number;
};

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

const PIE_COLORS = ["#2563eb", "#22c55e", "#eab308", "#f97316", "#ec4899", "#8b5cf6", "#06b6d4", "#64748b"];

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
  const [revenueByCategory, setRevenueByCategory] = useState<RevenueByProductItem[]>([]);
  const [revenueByProduct, setRevenueByProduct] = useState<RevenueByProductItem[]>([]);
  const [revenueBySale, setRevenueBySale] = useState<RevenueByProductItem[]>([]);
  const [revenueByPaymentMethod, setRevenueByPaymentMethod] = useState<RevenueByProductItem[]>([]);
  const [revenueByPageName, setRevenueByPageName] = useState<RevenueByProductItem[]>([]);
  const [revenueShippingPaymentBuckets, setRevenueShippingPaymentBuckets] = useState<ShippingPaymentBucketRow[]>([]);
  const [revenueShippingPaymentOther, setRevenueShippingPaymentOther] = useState(0);
  const [pieChartMode, setPieChartMode] = useState<"category" | "product_name">("category");
  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");

  const role = getUserRole();
  const canAccess = role === "manager" || role === "account";

  const buildRevenueParams = (
    from?: string,
    to?: string,
    categoryOverride?: string
  ): Record<string, string | string[]> => {
    const params: Record<string, string | string[]> = {};
    if (from?.trim()) params.created_from = from.trim();
    if (to?.trim()) params.created_to = to.trim();
    const cat = (categoryOverride !== undefined ? categoryOverride : selectedCategory).trim();
    if (cat) params.product_category = [cat];
    return params;
  };

  const fetchData = (from?: string, to?: string, categoryOverride?: string) => {
    setLoading(true);
    setError(null);
    const params = buildRevenueParams(from, to, categoryOverride);
    const reqSummary = api.get<RevenueSummary>("/orders/revenue-summary", { params });
    const reqSeries = api.get<{ series: RevenueByDateItem[] }>("/orders/revenue-by-date", { params });
    const reqByCategory = api.get<{ items: RevenueByProductItem[] }>("/orders/revenue-by-product", {
      params: { ...params, group_by: "category" },
    });
    const reqByProduct = api.get<{ items: RevenueByProductItem[] }>("/orders/revenue-by-product", {
      params: { ...params, group_by: "product_name" },
    });
    const reqBySale = api.get<{ items: RevenueByProductItem[] }>("/orders/revenue-by-sale", { params });
    const reqByPaymentMethod = api.get<{ items: RevenueByProductItem[] }>("/orders/revenue-by-payment-method", {
      params,
    });
    const reqByPageName = api.get<{ items: RevenueByProductItem[] }>("/orders/revenue-by-page-name", { params });
    const reqShippingPayment = api.get<{
      items: ShippingPaymentBucketRow[];
      other_revenue?: number;
    }>("/orders/revenue-by-shipping-payment-buckets", { params });
    Promise.all([
      reqSummary,
      reqSeries,
      reqByCategory,
      reqByProduct,
      reqBySale,
      reqByPaymentMethod,
      reqByPageName,
      reqShippingPayment,
    ])
      .then(([resS, resD, resCat, resProd, resSale, resPay, resPage, resSP]) => {
        setSummary(resS.data);
        setSeries(Array.isArray(resD.data?.series) ? resD.data.series : []);
        setRevenueByCategory(Array.isArray(resCat.data?.items) ? resCat.data.items : []);
        setRevenueByProduct(Array.isArray(resProd.data?.items) ? resProd.data.items : []);
        setRevenueBySale(Array.isArray(resSale.data?.items) ? resSale.data.items : []);
        setRevenueByPaymentMethod(Array.isArray(resPay.data?.items) ? resPay.data.items : []);
        setRevenueByPageName(Array.isArray(resPage.data?.items) ? resPage.data.items : []);
        setRevenueShippingPaymentBuckets(Array.isArray(resSP.data?.items) ? resSP.data.items : []);
        setRevenueShippingPaymentOther(
          typeof resSP.data?.other_revenue === "number" ? resSP.data.other_revenue : 0
        );
        setAppliedFrom(from ?? "");
        setAppliedTo(to ?? "");
      })
      .catch(() => {
        setError("Failed to load revenue data.");
        setRevenueByPaymentMethod([]);
        setRevenueByPageName([]);
        setRevenueShippingPaymentBuckets([]);
        setRevenueShippingPaymentOther(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!canAccess) return;
    fetchData();
  }, [canAccess]);

  useEffect(() => {
    if (!canAccess) return;
    api
      .get<Array<{ category?: string | null }>>("/products")
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        const cats = [
          ...new Set(
            list.map((p) => (p.category ?? "").trim()).filter((c): c is string => Boolean(c))
          ),
        ].sort((a, b) => a.localeCompare(b));
        setProductCategories(cats);
      })
      .catch(() => setProductCategories([]));
  }, [canAccess]);

  const handleApplyRange = () => {
    fetchData(dateFrom || undefined, dateTo || undefined);
  };

  const handleAllTime = () => {
    setDateFrom("");
    setDateTo("");
    fetchData();
  };

  const formatDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const setQuickRange = (days: number) => {
    const today = new Date();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const start = new Date(end);
    start.setDate(end.getDate() - (days - 1));
    const fromStr = formatDate(start);
    const toStr = formatDate(end);
    setDateFrom(fromStr);
    setDateTo(toStr);
    fetchData(fromStr, toStr);
  };

  const handleToday = () => {
    const today = new Date();
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const s = formatDate(d);
    setDateFrom(s);
    setDateTo(s);
    fetchData(s, s);
  };

  const handleYesterday = () => {
    const today = new Date();
    const y = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    y.setDate(y.getDate() - 1);
    const s = formatDate(y);
    setDateFrom(s);
    setDateTo(s);
    fetchData(s, s);
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
        <button
          type="button"
          onClick={handleToday}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #555",
            background: "#333",
            color: "#eee",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Today
        </button>
        <button
          type="button"
          onClick={handleYesterday}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #555",
            background: "#333",
            color: "#eee",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Yesterday
        </button>
        <button
          type="button"
          onClick={() => setQuickRange(7)}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #555",
            background: "#333",
            color: "#eee",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          7 days
        </button>
        <button
          type="button"
          onClick={() => setQuickRange(14)}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #555",
            background: "#333",
            color: "#eee",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          14 days
        </button>
        <button
          type="button"
          onClick={() => setQuickRange(30)}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #555",
            background: "#333",
            color: "#eee",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          30 days
        </button>
        <span style={{ color: "#aaa", fontSize: 14 }}>Product category:</span>
        <select
          value={selectedCategory}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedCategory(v);
            fetchData(dateFrom || undefined, dateTo || undefined, v);
          }}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #555",
            background: "#252525",
            color: "#eee",
            fontSize: 14,
            minWidth: 160,
          }}
        >
          <option value="">All categories</option>
          {productCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
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
        <>
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
              let productCount = 0;
              if (key === "all") {
                productCount = summary.total_product_count ?? 0;
              } else if (key === "pending") {
                productCount = summary.pending_product_count ?? 0;
              } else if (key === "checked") {
                productCount = summary.checked_product_count ?? 0;
              } else if (key === "packing_shipping") {
                productCount = summary.packing_shipping_product_count ?? 0;
              } else if (key === "success") {
                productCount = summary.success_product_count ?? 0;
              } else if (key === "fail_return") {
                productCount = summary.fail_return_product_count ?? 0;
              }
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
                    <span style={valueStyle}>
                      {formatBath(value)}
                      <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 8 }}>
                        {productCount.toLocaleString("th-TH")} pcs
                      </span>
                    </span>
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

        {/* Pie charts row: revenue by category/product name (left) and by sale name (right) */}
        <div
          style={{
            marginTop: 24,
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          {/* Left: revenue by category or product name */}
          <div
            style={{
              flex: "1 1 320px",
              minWidth: 280,
              background: "#252525",
              border: "1px solid #333",
              borderRadius: 12,
              padding: 16,
              minHeight: 320,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 14, color: "#9ca3af" }}>
                Revenue by {pieChartMode === "category" ? "product category" : "product name"}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPieChartMode((m) => (m === "category" ? "product_name" : "category"))
                }
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #555",
                  background: pieChartMode === "category" ? "#333" : "#2563eb",
                  color: "#eee",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {pieChartMode === "category"
                  ? "Show by product name"
                  : "Show by category"}
              </button>
            </div>
            {(() => {
              const pieData = (pieChartMode === "category"
                ? revenueByCategory
                : revenueByProduct
              )
                .filter((d) => (d.revenue ?? 0) > 0)
                .map((d) => ({ name: d.name, value: d.revenue }));
              if (pieData.length === 0) {
                return (
                  <p style={{ color: "#666", padding: 24, margin: 0 }}>
                    No revenue data in range
                  </p>
                );
              }
              return (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) =>
                        `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={{ stroke: "#888" }}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #444" }}
                      formatter={(value: unknown) => [formatBath(Number(value ?? 0)), "Revenue"]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              );
            })()}
          </div>

          {/* Right: revenue by sale name */}
          <div
            style={{
              flex: "1 1 320px",
              minWidth: 280,
              background: "#252525",
              border: "1px solid #333",
              borderRadius: 12,
              padding: 16,
              minHeight: 320,
            }}
          >
            <div style={{ fontSize: 14, color: "#9ca3af", marginBottom: 16 }}>
              Revenue by sale name
            </div>
            {(() => {
              const salePieData = revenueBySale
                .filter((d) => (d.revenue ?? 0) > 0)
                .map((d) => ({ name: d.name, value: d.revenue }));
              if (salePieData.length === 0) {
                return (
                  <p style={{ color: "#666", padding: 24, margin: 0 }}>
                    No revenue data in range
                  </p>
                );
              }
              return (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={salePieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) =>
                        `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={{ stroke: "#888" }}
                    >
                      {salePieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #444" }}
                      formatter={(value: unknown) => [formatBath(Number(value ?? 0)), "Revenue"]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              );
            })()}
          </div>

          {/* Revenue by payment method */}
          <div
            style={{
              flex: "1 1 320px",
              minWidth: 280,
              background: "#252525",
              border: "1px solid #333",
              borderRadius: 12,
              padding: 16,
              minHeight: 320,
            }}
          >
            <div style={{ fontSize: 14, color: "#9ca3af", marginBottom: 16 }}>
              Revenue by payment method
            </div>
            {(() => {
              const paymentMethodLabels: Record<string, string> = {
                cod: "ปลายทาง (COD)",
                transfer: "โอน",
                card_2c2p: "บัตร 2C2P",
                card_pay: "บัตร PAY",
              };
              const payPieData = revenueByPaymentMethod
                .filter((d) => (d.revenue ?? 0) > 0)
                .map((d) => ({
                  name: paymentMethodLabels[d.name] ?? d.name,
                  value: d.revenue,
                }));
              if (payPieData.length === 0) {
                return (
                  <p style={{ color: "#666", padding: 24, margin: 0 }}>
                    No revenue data in range
                  </p>
                );
              }
              return (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={payPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) =>
                        `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={{ stroke: "#888" }}
                    >
                      {payPieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #444" }}
                      formatter={(value: unknown) => [formatBath(Number(value ?? 0)), "Revenue"]}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
        </div>

        {/* Revenue by page name + shipping/payment buckets */}
        <div
          style={{
            marginTop: 24,
            display: "flex",
            flexWrap: "wrap",
            gap: 24,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              flex: "1 1 320px",
              maxWidth: 520,
              minWidth: 280,
              background: "#252525",
              border: "1px solid #333",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 14, color: "#9ca3af", marginBottom: 12 }}>
              Revenue by page name
            </div>
            {revenueByPageName.length === 0 ? (
              <p style={{ color: "#666", margin: 0 }}>No revenue in range</p>
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  maxHeight: 360,
                  overflowY: "auto",
                }}
              >
                {revenueByPageName.map((row) => (
                  <li
                    key={row.name}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 0",
                      borderBottom: "1px solid #333",
                      fontSize: 14,
                    }}
                  >
                    <span style={{ color: "#e5e5e5" }}>{row.name}</span>
                    <span style={{ color: "#fff", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {formatBath(row.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div
            style={{
              flex: "1 1 360px",
              maxWidth: 560,
              minWidth: 280,
              background: "#252525",
              border: "1px solid #333",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 14, color: "#9ca3af", marginBottom: 12 }}>
              Revenue by order &amp; payment (shipping view)
            </div>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
              }}
            >
              {revenueShippingPaymentBuckets.map((row, idx) => (
                <li
                  key={row.key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: "1px solid #333",
                    fontSize: 14,
                  }}
                >
                  <span style={{ color: "#e5e5e5" }}>
                    <span style={{ color: "#6b7280", marginRight: 8 }}>{idx + 1}.</span>
                    {row.label}
                  </span>
                  <span style={{ color: "#fff", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {formatBath(row.revenue)}
                  </span>
                </li>
              ))}
            </ul>
            {revenueShippingPaymentOther > 0.01 && (
              <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 12, marginBottom: 0 }}>
                Other orders (not in the rows above, e.g. other statuses or COD with other payment
                statuses): {formatBath(revenueShippingPaymentOther)}
              </p>
            )}
          </div>
        </div>
        </>
      ) : null}
    </div>
  );
}
