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

const PAYMENT_COLUMNS = [
  { key: "Unchecked", label: "Unchecked" },
  { key: "Checked", label: "Checked" },
  { key: "Paid", label: "Paid" },
  { key: "Received", label: "Received" },
  { key: "Unmatched", label: "Unmatched" },
] as const;

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

  const role = getUserRole();
  const canAccess = role === "account" || role === "manager";

  const fetchAll = () => {
    setLoading(true);
    setError(null);
    Promise.all(
      PAYMENT_COLUMNS.map(({ key }) =>
        api.get<OrderRow[]>("/orders", { params: { payment_status: key, sort_by: "oldest" } })
      )
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
    fetchAll();
  }, []);

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
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, marginBottom: 16, background: "#3b0000", color: "#fcc", borderRadius: 8 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        {PAYMENT_COLUMNS.map(({ key, label }) => renderTable(label, ordersByStatus[key] ?? []))}
      </div>

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
