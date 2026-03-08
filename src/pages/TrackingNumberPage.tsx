import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "../services/api";
import OrderDetailModal, { type OrderDetail } from "../components/OrderDetailModal";

const TRACKING_STATUSES = ["Shipped", "Success", "Fail", "Return Received"];

type OrderRow = {
  id: number;
  order_code: string;
  sale_name?: string | null;
  customer_name: string | null;
  order_status: string;
  tracking_number?: string | null;
  has_unread_alert?: boolean;
  main_product_name?: string | null;
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

export default function TrackingNumberPage() {
  const role = getUserRole();
  const canAccess = role === "pack" || role === "manager";

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchOrders = () => {
    if (!canAccess) return;
    setLoading(true);
    setError(null);
    Promise.all(
      TRACKING_STATUSES.map((status) =>
        api.get<OrderRow[]>("/orders", {
          params: { order_status: status, sort_by: "oldest", has_tracking_number: false },
        })
      )
    )
      .then((results) => {
        const byId = new Map<number, OrderRow>();
        results.forEach((r) => {
          (Array.isArray(r.data) ? r.data : []).forEach((row) => byId.set(row.id, row));
        });
        setOrders(Array.from(byId.values()).sort((a, b) => a.id - b.id));
      })
      .catch(() => setError("Failed to load orders."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
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

  const startEdit = (row: OrderRow) => {
    setEditingId(row.id);
    setEditValue(row.tracking_number ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const submitTracking = async () => {
    if (editingId == null) return;
    setSaving(true);
    try {
      await api.put(`/orders/${editingId}/tracking-number`, {
        tracking_number: editValue.trim() || null,
      });
      setEditingId(null);
      setEditValue("");
      fetchOrders();
      if (selectedOrderId === editingId) {
        const { data } = await api.get<OrderDetail>(`/orders/${editingId}`);
        setDetail(data);
      }
    } catch {
      setError("Failed to save tracking number.");
    } finally {
      setSaving(false);
    }
  };

  if (!canAccess) return <Navigate to="/menu" replace />;

  const pageStyle: React.CSSProperties = {
    padding: 24,
    maxWidth: 1200,
    margin: "0 auto",
    fontFamily: "system-ui, -apple-system, sans-serif",
  };
  const headerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  };
  const tableWrap: React.CSSProperties = {
    overflowX: "auto",
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 12,
  };
  const tableStyle: React.CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  };
  const thStyle: React.CSSProperties = {
    padding: "12px 14px",
    textAlign: "left",
    fontWeight: 600,
    background: "#252525",
    color: "#eee",
    borderBottom: "1px solid #333",
  };
  const tdStyle: React.CSSProperties = {
    padding: "12px 14px",
    borderBottom: "1px solid #2a2a2a",
    color: "#ddd",
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
  const inputStyle: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid #555",
    background: "#252530",
    color: "#eee",
    fontSize: 14,
    minWidth: 160,
  };
  const btnStyle: React.CSSProperties = {
    padding: "8px 14px",
    borderRadius: 6,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
    marginLeft: 8,
  };

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: 22, color: "#f0f0f0" }}>
          📦 Tracking Number
        </h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <a
            href="https://www.dhl.com/th-en/home/tracking.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...linkStyle, display: "inline-flex", alignItems: "center" }}
          >
            🔍 DHL Track
          </a>
          <Link to="/orders" style={linkStyle}>
            ← Order List
          </Link>
        </div>
      </div>

      <p style={{ color: "#9ca3af", marginBottom: 16, fontSize: 14 }}>
        Only orders that don’t have a tracking number yet (Shipped, Success, Fail, or Return Received). Add below; after save and refresh they disappear from this list.
      </p>

      {error && (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            background: "rgba(220, 38, 38, 0.15)",
            color: "#fca5a5",
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: "#888" }}>Loading…</p>
      ) : (
        <div style={tableWrap}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Order ID</th>
                <th style={thStyle}>Sale name</th>
                <th style={thStyle}>Customer name</th>
                <th style={thStyle}>Order status</th>
                <th style={thStyle}>Tracking number</th>
                <th style={thStyle}>Alert</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "#666" }}>
                    No orders needing a tracking number. All Shipped / Success / Fail / Return Received orders have one.
                  </td>
                </tr>
              ) : (
                orders.map((row) => {
                  const hasNoTracking = !row.tracking_number || !String(row.tracking_number).trim();
                  const isEditing = editingId === row.id;
                  return (
                    <tr
                      key={row.id}
                      style={{
                        background: hasNoTracking ? "rgba(251, 191, 36, 0.08)" : undefined,
                        cursor: "pointer",
                      }}
                      onClick={() => !isEditing && openDetail(row.id)}
                    >
                      <td style={tdStyle}>{row.order_code ?? "-"}</td>
                      <td style={tdStyle}>{row.sale_name ?? "-"}</td>
                      <td style={tdStyle}>{row.customer_name ?? "-"}</td>
                      <td style={tdStyle}>{row.order_status ?? "-"}</td>
                      <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                        {isEditing ? (
                          <>
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") submitTracking();
                                if (e.key === "Escape") cancelEdit();
                              }}
                              style={inputStyle}
                              placeholder="Tracking number"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={submitTracking}
                              disabled={saving}
                              style={btnStyle}
                            >
                              {saving ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              style={{ ...btnStyle, background: "#555", marginLeft: 4 }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : hasNoTracking ? (
                          <span style={{ color: "#f59e0b", fontWeight: 500 }}>— Not set</span>
                        ) : (
                          row.tracking_number
                        )}
                      </td>
                      <td style={tdStyle}>{row.has_unread_alert ? "⚠️" : "—"}</td>
                      <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            style={{ ...btnStyle, padding: "6px 12px" }}
                          >
                            {hasNoTracking ? "Add" : "Edit"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedOrderId != null && (
        <OrderDetailModal
          orderId={selectedOrderId}
          detail={detail}
          detailLoading={detailLoading}
          onClose={closeModal}
          onReload={() => { fetchOrders(); if (detail) openDetail(selectedOrderId); }}
        />
      )}
    </div>
  );
}
