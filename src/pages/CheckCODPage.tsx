import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "../services/api";
import { fetchOrdersAllPages } from "../services/ordersList";

type CodRow = {
  id: number;
  order_code: string;
  shipping_date?: string | null;
  customer_name: string | null;
  main_product_name?: string | null;
  payment_status: string;
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

export default function CheckCODPage() {
  const role = getUserRole();
  const canAccess = role === "pack" || role === "manager";

  const [rows, setRows] = useState<CodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const fetchRows = () => {
    if (!canAccess) return;
    setLoading(true);
    setError(null);
    fetchOrdersAllPages<CodRow>({
      payment_status: "Unchecked",
      payment_method: "cod",
      sort_by: "oldest",
    })
      .then((list) => {
        setRows(list);
      })
      .catch(() => setError("Failed to load COD orders."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRows();
  }, [canAccess]);

  const handleCheck = async (row: CodRow) => {
    if (!window.confirm(`เปลี่ยนสถานะชำระเงินของ ${row.order_code} จาก Unchecked เป็น Checked ?`)) return;
    setSavingId(row.id);
    setError(null);
    try {
      await api.put(`/orders/${row.id}/payment-status`, null, {
        params: { new_status: "Checked" },
      });
      fetchRows();
    } catch {
      setError("Failed to update payment status.");
    } finally {
      setSavingId(null);
    }
  };

  if (!localStorage.getItem("token")) return <Navigate to="/login" replace />;
  if (!canAccess) return <Navigate to="/menu" replace />;

  const pageStyle: React.CSSProperties = {
    padding: 24,
    maxWidth: 900,
    margin: "0 auto",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#eee",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  };

  const linkStyle: React.CSSProperties = {
    padding: "8px 14px",
    borderRadius: 8,
    border: "1px solid #555",
    background: "#333",
    color: "#eee",
    textDecoration: "none",
    fontSize: 14,
  };

  const tableWrapStyle: React.CSSProperties = {
    background: "#111827",
    border: "1px solid #374151",
    borderRadius: 12,
    overflow: "hidden",
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
    background: "#1f2933",
    borderBottom: "1px solid #374151",
  };

  const tdStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderBottom: "1px solid #374151",
  };

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Check COD</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Link to="/orders/packing" style={linkStyle}>
            ← Packing
          </Link>
          <Link to="/orders" style={linkStyle}>
            Order List
          </Link>
          <Link to="/menu" style={linkStyle}>
            Menu
          </Link>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: 10,
            marginBottom: 16,
            background: "#3b0000",
            color: "#fee2e2",
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}

      <div style={tableWrapStyle}>
        <div
          style={{
            padding: "12px 14px",
            fontWeight: 600,
            borderBottom: "1px solid #374151",
          }}
        >
          COD orders with Unchecked payment ({rows.length})
        </div>
        {loading ? (
          <p style={{ padding: 16, margin: 0, color: "#9ca3af" }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ padding: 16, margin: 0, color: "#9ca3af" }}>No COD orders waiting for check.</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Order ID</th>
                <th style={thStyle}>Shipping date</th>
                <th style={thStyle}>Customer</th>
                <th style={thStyle}>Product name</th>
                <th style={thStyle}>Payment status</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={tdStyle}>{row.order_code}</td>
                  <td style={tdStyle}>{row.shipping_date ?? "-"}</td>
                  <td style={tdStyle}>{row.customer_name ?? "-"}</td>
                  <td style={tdStyle}>{row.main_product_name ?? "-"}</td>
                  <td style={tdStyle}>{row.payment_status}</td>
                  <td style={tdStyle}>
                    <button
                      type="button"
                      onClick={() => handleCheck(row)}
                      disabled={savingId === row.id}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        border: "1px solid #10b981",
                        background: "#10b981",
                        color: "#fff",
                        fontSize: 13,
                        cursor: savingId === row.id ? "default" : "pointer",
                        opacity: savingId === row.id ? 0.7 : 1,
                      }}
                    >
                      {savingId === row.id ? "Saving…" : "Mark as Checked"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

