import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "../services/api";
import OrderDetailModal, { type OrderDetail } from "../components/OrderDetailModal";

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

type OrderRow = {
  id: number;
  order_code: string;
  customer_name: string | null;
  sale_name?: string | null;
  payment_status: string;
};

type SaleOption = {
  sale_id: number;
  name: string;
};

const PAYMENT_COLUMNS = [
  { key: "Unchecked", label: "Unchecked" },
  { key: "Checked", label: "Checked" },
  { key: "Paid", label: "Paid" },
  { key: "Received", label: "Received" },
  { key: "Unmatched", label: "Unmatched" },
] as const;

const PAYMENT_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "cod", label: "ปลายทาง (COD)" },
  { value: "transfer", label: "โอน" },
  { value: "card_2c2p", label: "บัตร 2C2P" },
  { value: "card_pay", label: "บัตร PAY" },
];

export default function AccountantPage() {
  const [ordersByStatus, setOrdersByStatus] = useState<Record<string, OrderRow[]>>({
    Unchecked: [],
    Checked: [],
    Paid: [],
    Received: [],
    Unmatched: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sales, setSales] = useState<SaleOption[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exportSaleId, setExportSaleId] = useState<string>("");
  const [exportPaymentMethod, setExportPaymentMethod] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportOrderStatus, setExportOrderStatus] = useState("");
  const [exportPaymentStatus, setExportPaymentStatus] = useState("");

  const role = getUserRole();
  const canAccess = role === "account" || role === "manager";

  const fetchAll = () => {
    setLoading(true);
    setError(null);
    Promise.all(
      PAYMENT_COLUMNS.map(({ key }) => {
        const params: Record<string, string> = {
          payment_status: key,
          sort_by: "oldest",
        };
        if (paymentMethodFilter) params.payment_method = paymentMethodFilter;
        if (keyword.trim()) params.keyword = keyword.trim();
        return api.get<OrderRow[]>("/orders", { params });
      })
    )
      .then((results) => {
        const next: Record<string, OrderRow[]> = {};
        PAYMENT_COLUMNS.forEach(({ key }, i) => {
          next[key] = Array.isArray(results[i].data) ? results[i].data : [];
        });
        setOrdersByStatus(next);
      })
      .catch(() => setError("Failed to load orders."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(() => fetchAll(), keyword ? 300 : 0);
    return () => clearTimeout(t);
  }, [paymentMethodFilter, keyword]);

  useEffect(() => {
    if (!canAccess) return;
    // Load sale list for export filter
    api
      .get<{ items: { sale_id?: number; name: string; revenue: number }[] }>(
        "/orders/revenue-by-sale"
      )
      .then((res) => {
        const list = Array.isArray(res.data?.items) ? res.data.items : [];
        const opts: SaleOption[] = list
          .filter((it) => it.sale_id != null)
          .map((it) => ({ sale_id: it.sale_id as number, name: it.name || "-" }));
        setSales(opts);
      })
      .catch(() => setSales([]));
  }, [canAccess]);

  const openDetail = async (orderId: number) => {
    setSelectedOrderId(orderId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const { data } = await api.get<OrderDetail>(`/orders/${orderId}`);
      setDetail(data);
    } catch {
      setError("Failed to load order details.");
      setSelectedOrderId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedOrderId(null);
    setDetail(null);
  };

  const handleReload = async () => {
    if (selectedOrderId == null) return;
    try {
      const { data } = await api.get<OrderDetail>(`/orders/${selectedOrderId}`);
      setDetail(data);
      fetchAll();
    } catch {
      setError("Failed to reload.");
    }
  };

  const columnStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 220,
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 8,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };
  const tableStyle: React.CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  };
  const thStyle: React.CSSProperties = {
    padding: "10px 12px",
    textAlign: "left",
    fontWeight: 600,
    background: "#2b2b2b",
    color: "#eee",
    borderBottom: "1px solid #333",
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderBottom: "1px solid #2a2a2a",
    color: "#ddd",
  };
  const headerStyle: React.CSSProperties = {
    padding: "12px 14px",
    fontWeight: 700,
    fontSize: 15,
    borderBottom: "2px solid #444",
    background: "#252525",
    color: "#fff",
  };

  const renderTable = (label: string, orders: OrderRow[]) => (
    <div style={columnStyle}>
      <div style={headerStyle}>
        {label}
        <span style={{ fontSize: 12, fontWeight: 400, color: "#9ca3af", marginLeft: 8 }}>
          ({orders.length})
        </span>
      </div>
      <div style={{ overflow: "auto", flex: 1, minHeight: 200 }}>
        {loading ? (
          <p style={{ padding: 16, color: "#888" }}>Loading…</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Order ID</th>
                <th style={thStyle}>Sale name</th>
                <th style={thStyle}>Customer name</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "#666" }}>
                    No orders
                  </td>
                </tr>
              ) : (
                orders.map((row) => (
                  <tr
                    key={row.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => openDetail(row.id)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#252525"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
                  >
                    <td style={tdStyle}>{row.order_code ?? "-"}</td>
                    <td style={tdStyle}>{row.sale_name ?? "-"}</td>
                    <td style={tdStyle}>{row.customer_name ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  if (!canAccess) return <Navigate to="/menu" replace />;

  return (
    <div style={{ padding: 24, maxWidth: 1600, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Accountant — By payment status</h1>
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
          <button
            type="button"
            onClick={() => {
              setExportError(null);
              setExportOpen(true);
            }}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "1px solid #2563eb",
              background: "#2563eb",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Export
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, marginBottom: 16, background: "#3b0000", color: "#fcc", borderRadius: 8 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ color: "#aaa", fontSize: 14 }}>Payment method:</span>
        <select
          value={paymentMethodFilter}
          onChange={(e) => setPaymentMethodFilter(e.target.value)}
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
          {PAYMENT_METHOD_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search order ID, customer name, phone, sale name…"
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #555",
            background: "#252525",
            color: "#eee",
            fontSize: 14,
            minWidth: 260,
            flex: 1,
            maxWidth: 360,
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        {PAYMENT_COLUMNS.map(({ key, label }) => renderTable(label, ordersByStatus[key] ?? []))}
      </div>

      {exportOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              background: "#111827",
              borderRadius: 12,
              border: "1px solid #374151",
              padding: 20,
              color: "#eee",
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 18 }}>
              Export orders to Excel
            </h2>
            <p style={{ marginTop: 0, marginBottom: 16, fontSize: 13, color: "#9ca3af" }}>
              เลือกช่วงวันที่สร้างออเดอร์, พนักงานขาย และช่องทางชำระเงินที่ต้องการ Export.
            </p>

            {exportError && (
              <div
                style={{
                  padding: 8,
                  marginBottom: 10,
                  background: "#3b0000",
                  color: "#fcc",
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                {exportError}
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <label style={{ fontSize: 13, color: "#e5e7eb" }}>
                Order created date:
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <input
                    type="date"
                    value={exportFrom}
                    onChange={(e) => setExportFrom(e.target.value)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid #4b5563",
                      background: "#020617",
                      color: "#e5e7eb",
                      fontSize: 13,
                    }}
                  />
                  <span style={{ color: "#9ca3af" }}>–</span>
                  <input
                    type="date"
                    value={exportTo}
                    onChange={(e) => setExportTo(e.target.value)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid #4b5563",
                      background: "#020617",
                      color: "#e5e7eb",
                      fontSize: 13,
                    }}
                  />
                </div>
              </label>

              <label style={{ fontSize: 13, color: "#e5e7eb" }}>
                Sale:
                <select
                  value={exportSaleId}
                  onChange={(e) => setExportSaleId(e.target.value)}
                  style={{
                    marginTop: 4,
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #4b5563",
                    background: "#020617",
                    color: "#e5e7eb",
                    fontSize: 13,
                  }}
                >
                  <option value="">All</option>
                  {sales.map((s) => (
                    <option key={s.sale_id} value={String(s.sale_id)}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ fontSize: 13, color: "#e5e7eb" }}>
                Order status:
                <select
                  value={exportOrderStatus}
                  onChange={(e) => setExportOrderStatus(e.target.value)}
                  style={{
                    marginTop: 4,
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #4b5563",
                    background: "#020617",
                    color: "#e5e7eb",
                    fontSize: 13,
                  }}
                >
                  <option value="">All</option>
                  <option value="Pending">Pending</option>
                  <option value="Checked">Checked</option>
                  <option value="Packing">Packing</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Success">Success</option>
                  <option value="Fail">Fail</option>
                  <option value="Return Received">Return Received</option>
                </select>
              </label>

              <label style={{ fontSize: 13, color: "#e5e7eb" }}>
                Payment method:
                <select
                  value={exportPaymentMethod}
                  onChange={(e) => setExportPaymentMethod(e.target.value)}
                  style={{
                    marginTop: 4,
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #4b5563",
                    background: "#020617",
                    color: "#e5e7eb",
                    fontSize: 13,
                  }}
                >
                  {PAYMENT_METHOD_OPTIONS.map((opt) => (
                    <option key={opt.value || "all-export"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ fontSize: 13, color: "#e5e7eb" }}>
                Payment status:
                <select
                  value={exportPaymentStatus}
                  onChange={(e) => setExportPaymentStatus(e.target.value)}
                  style={{
                    marginTop: 4,
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #4b5563",
                    background: "#020617",
                    color: "#e5e7eb",
                    fontSize: 13,
                  }}
                >
                  <option value="">All</option>
                  <option value="Unchecked">Unchecked</option>
                  <option value="Checked">Checked</option>
                  <option value="Paid">Paid</option>
                  <option value="Received">Received</option>
                  <option value="Unmatched">Unmatched</option>
                </select>
              </label>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 8,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (!exportLoading) {
                    setExportOpen(false);
                  }
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #4b5563",
                  background: "#020617",
                  color: "#e5e7eb",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={exportLoading}
                onClick={async () => {
                  try {
                    setExportLoading(true);
                    setExportError(null);
                    const params: Record<string, string> = {};
                    if (exportFrom.trim()) params.created_from = exportFrom.trim();
                    if (exportTo.trim()) params.created_to = exportTo.trim();
                    if (exportSaleId) params.sale_id = exportSaleId;
                    if (exportPaymentMethod) params.payment_method = exportPaymentMethod;
                    if (exportOrderStatus) params.order_status = exportOrderStatus;
                     if (exportPaymentStatus) params.payment_status = exportPaymentStatus;

                    const res = await api.post<ArrayBuffer>(
                      "/orders/export-orders",
                      null,
                      {
                        params,
                        responseType: "arraybuffer",
                      }
                    );

                    const blob = new Blob([res.data], {
                      type:
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    const baseName =
                      exportFrom && exportTo
                        ? `orders_${exportFrom}_${exportTo}`
                        : "orders_all";
                    a.download = `${baseName}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    setExportOpen(false);
                  } catch {
                    setExportError("Failed to export orders.");
                  } finally {
                    setExportLoading(false);
                  }
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #10b981",
                  background: exportLoading ? "#065f46" : "#059669",
                  color: "#ecfdf5",
                  fontSize: 13,
                  cursor: exportLoading ? "default" : "pointer",
                }}
              >
                {exportLoading ? "Exporting…" : "Export"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedOrderId != null && (
        <OrderDetailModal
          orderId={selectedOrderId}
          detail={detail}
          detailLoading={detailLoading}
          onClose={closeModal}
          onReload={handleReload}
        />
      )}
    </div>
  );
}
