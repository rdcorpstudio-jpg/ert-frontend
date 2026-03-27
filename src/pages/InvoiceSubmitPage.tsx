import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "../services/api";
import { fetchOrdersAllPages } from "../services/ordersList";
import OrderDetailModal, { type OrderDetail } from "../components/OrderDetailModal";

type OrderRow = {
  id: number;
  order_code: string;
  customer_name: string | null;
  sale_name?: string | null;
  order_status?: string;
  payment_status?: string;
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

export default function InvoiceSubmitPage() {
  const role = getUserRole();
  const canAccess = role === "account" || role === "manager";

  const [waitingOrders, setWaitingOrders] = useState<OrderRow[]>([]);
  const [doneOrders, setDoneOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [uploadingId, setUploadingId] = useState<number | null>(null);

  const fetchOrders = () => {
    if (!canAccess) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchOrdersAllPages<OrderRow>({
        invoice_required: true,
        has_invoice_file: false,
        sort_by: "oldest",
      }),
      fetchOrdersAllPages<OrderRow>({
        invoice_required: true,
        has_invoice_file: true,
        sort_by: "oldest",
      }),
    ])
      .then(([waiting, done]) => {
        setWaitingOrders(waiting);
        setDoneOrders(done);
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

  const handleUpload = async (orderId: number, file: File) => {
    const form = new FormData();
    form.append("file_type", "invoice_submit");
    form.append("file", file);
    setUploadingId(orderId);
    setError(null);
    try {
      await api.post(`/orders/${orderId}/upload-file`, form);
      fetchOrders();
      if (selectedOrderId === orderId) {
        const { data } = await api.get<OrderDetail>(`/orders/${orderId}`);
        setDetail(data);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg && typeof msg === "string" ? msg : "Failed to upload invoice file.");
    } finally {
      setUploadingId(null);
    }
  };

  if (!canAccess) return <Navigate to="/menu" replace />;

  const pageStyle: React.CSSProperties = {
    padding: 24,
    maxWidth: 1000,
    margin: "0 auto",
    fontFamily: "system-ui, -apple-system, sans-serif",
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
  const sectionStyle: React.CSSProperties = {
    marginBottom: 32,
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 12,
    overflow: "hidden",
  };
  const sectionHeaderStyle: React.CSSProperties = {
    padding: "14px 18px",
    fontWeight: 700,
    fontSize: 16,
    borderBottom: "1px solid #333",
    background: "#252525",
    color: "#f0f0f0",
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
    background: "#2b2b2b",
    color: "#eee",
    borderBottom: "1px solid #333",
  };
  const tdStyle: React.CSSProperties = {
    padding: "12px 14px",
    borderBottom: "1px solid #2a2a2a",
    color: "#ddd",
  };
  const btnStyle: React.CSSProperties = {
    padding: "8px 14px",
    borderRadius: 6,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
  };

  const renderTable = (orders: OrderRow[], showUpload: boolean) => (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Order ID</th>
          <th style={thStyle}>Customer name</th>
          <th style={thStyle}>Sale name</th>
          {showUpload && <th style={thStyle}>Upload invoice</th>}
        </tr>
      </thead>
      <tbody>
        {orders.length === 0 ? (
          <tr>
            <td
              colSpan={showUpload ? 4 : 3}
              style={{ ...tdStyle, textAlign: "center", color: "#666" }}
            >
              {showUpload ? "No orders waiting for invoice." : "No orders with invoice submitted yet."}
            </td>
          </tr>
        ) : (
          orders.map((row) => (
            <tr
              key={row.id}
              style={{ cursor: "pointer" }}
              onClick={() => openDetail(row.id)}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#252525")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "")}
            >
              <td style={tdStyle}>{row.order_code ?? "-"}</td>
              <td style={tdStyle}>{row.customer_name ?? "-"}</td>
              <td style={tdStyle}>{row.sale_name ?? "-"}</td>
              {showUpload && (
                <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                  <label style={{ margin: 0, cursor: "pointer" }}>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      style={{ display: "none" }}
                      disabled={uploadingId === row.id}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(row.id, f);
                        e.target.value = "";
                      }}
                    />
                    <span
                      style={{
                        ...btnStyle,
                        display: "inline-block",
                        opacity: uploadingId === row.id ? 0.7 : 1,
                        pointerEvents: uploadingId === row.id ? "none" : "auto",
                      }}
                    >
                      {uploadingId === row.id ? "Uploading…" : "Upload"}
                    </span>
                  </label>
                </td>
              )}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: 22, color: "#f0f0f0" }}>
          📄 Invoice Submit
        </h1>
        <Link to="/orders" style={linkStyle}>
          ← Order List
        </Link>
      </div>

      <p style={{ color: "#9ca3af", marginBottom: 20, fontSize: 14 }}>
        Orders that require invoice. Upload invoice file (saved to the Invoice Submit folder).
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
        <>
          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              Waiting submit ({waitingOrders.length})
            </div>
            {renderTable(waitingOrders, true)}
          </div>

          <div style={sectionStyle}>
            <div style={sectionHeaderStyle}>
              Done ({doneOrders.length})
            </div>
            {renderTable(doneOrders, false)}
          </div>
        </>
      )}

      {selectedOrderId != null && (
        <OrderDetailModal
          orderId={selectedOrderId}
          detail={detail}
          detailLoading={detailLoading}
          onClose={closeModal}
          onReload={() => {
            fetchOrders();
            if (selectedOrderId != null) openDetail(selectedOrderId);
          }}
        />
      )}
    </div>
  );
}
