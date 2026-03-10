import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import OrderDetailModal, { type OrderDetail } from "../components/OrderDetailModal";

// -----------------------------------------------------------------------------
// Types (match backend list + detail)
// -----------------------------------------------------------------------------

type OrderRow = {
  id: number;
  order_code: string;
  customer_name: string | null;
  order_status: string;
  payment_status: string;
  has_unread_alert?: boolean;
  has_invoice_submitted?: boolean;
  invoice_submit_file_url?: string | null;
  sale_id?: number | null;
  tracking_number?: string | null;
  shipping_date?: string | null;
};

// -----------------------------------------------------------------------------
// Page component
// -----------------------------------------------------------------------------

type SortBy = "newest" | "oldest";

export default function OrderListPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filters & sort
  const [keyword, setKeyword] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [hasAlert, setHasAlert] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [shippingDate, setShippingDate] = useState(""); // YYYY-MM-DD for filter

  const fetchOrders = async (overrides?: {
    keyword?: string;
    order_status?: string;
    payment_status?: string;
    has_alert?: boolean;
    sort_by?: SortBy;
    shipping_date?: string;
  }) => {
    const k = overrides?.keyword !== undefined ? overrides.keyword : keyword;
    const os = overrides?.order_status !== undefined ? overrides.order_status : orderStatus;
    const ps = overrides?.payment_status !== undefined ? overrides.payment_status : paymentStatus;
    const ha = overrides?.has_alert !== undefined ? overrides.has_alert : hasAlert;
    const sb = overrides?.sort_by !== undefined ? overrides.sort_by : sortBy;
    const sd = overrides?.shipping_date !== undefined ? overrides.shipping_date : shippingDate;
    const role = getUserRole();
    const params: Record<string, string | boolean | undefined> = {
      keyword: String(k).trim() || undefined,
      order_status: os || undefined,
      payment_status: ps || undefined,
      has_alert: ha || undefined,
      sort_by: sb,
      shipping_date: sd || undefined,
    };
    if (role === "sale") params.only_my = true;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<OrderRow[]>("/orders", {
        params,
      });
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      setError("Failed to load orders.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial load and instant refetch when filter, sort, or shipping_date changes
  useEffect(() => {
    fetchOrders();
  }, [orderStatus, paymentStatus, sortBy, hasAlert, shippingDate]);

  const handleSearch = () => fetchOrders();

  const handleClearFilters = () => {
    setKeyword("");
    setOrderStatus("");
    setPaymentStatus("");
    setHasAlert(false);
    setShippingDate("");
    setSortBy("newest");
    fetchOrders({ keyword: "", order_status: "", payment_status: "", has_alert: false, shipping_date: "", sort_by: "newest" });
  };

  const getUserRole = (): string => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return "";
      const payload = JSON.parse(atob(token.split(".")[1]));
      return (payload?.role as string) ?? "";
    } catch {
      return "";
    }
  };
  const canUsePackingShortcut = (() => {
    const role = getUserRole();
    return role === "pack" || role === "manager";
  })();
  const canAccessAccountant = (() => {
    const role = getUserRole();
    return role === "account" || role === "manager";
  })();
  const canAccessTracking = (() => {
    const role = getUserRole();
    return role === "pack" || role === "manager";
  })();

  const navigate = useNavigate();
  const handlePackingShortcut = () => {
    if (!canUsePackingShortcut) return;
    navigate("/orders/packing");
  };
  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  };

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
      await fetchOrders();
    } catch {
      setError("Failed to reload.");
    }
  };

  // ---------------------------------------------------------------------------
  // Table styles
  // ---------------------------------------------------------------------------

  const tableWrap: React.CSSProperties = {
    width: "100%",
    overflowX: "auto",
    borderRadius: 8,
    border: "1px solid #333",
    background: "#1a1a1a",
  };

  const table: React.CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  };

  const th: React.CSSProperties = {
    padding: "12px 16px",
    textAlign: "left",
    fontWeight: 600,
    borderBottom: "1px solid #333",
    background: "#2b2b2b",
    color: "#eee",
  };

  const td: React.CSSProperties = {
    padding: "12px 16px",
    borderBottom: "1px solid #2a2a2a",
    color: "#ddd",
  };

  const [hoveredRowId, setHoveredRowId] = useState<number | null>(null);

  const rowStyle = (id: number): React.CSSProperties => ({
    cursor: "pointer",
    background: hoveredRowId === id ? "#252525" : undefined,
  });

  const alertIcon = (
    <span style={{ fontSize: 16 }} title="Has unread alerts">
      ⚠️
    </span>
  );

  const filterBarStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
    marginBottom: 16,
  };
  const inputStyle: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #444",
    background: "#222",
    color: "#eee",
    fontSize: 14,
    minWidth: 160,
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, minWidth: 140 };
  const btnStyle: React.CSSProperties = {
    padding: "8px 14px",
    borderRadius: 6,
    border: "1px solid #555",
    background: "#333",
    color: "#eee",
    cursor: "pointer",
    fontSize: 14,
  };
  const btnPrimaryStyle: React.CSSProperties = {
    ...btnStyle,
    background: "#2563eb",
    borderColor: "#2563eb",
  };

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Order List</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link
            to="/orders/create"
            style={{
              ...btnPrimaryStyle,
              textDecoration: "none",
            }}
          >
            + Create Order
          </Link>
          {canAccessAccountant && (
            <>
              <Link
                to="/orders/accountant"
                style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                title="Accountant view by payment status"
              >
                📒 Accountant
              </Link>
              <Link
                to="/orders/invoice-submit"
                style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                title="Upload invoice for orders that require it"
              >
                📄 Invoice Submit
              </Link>
            </>
          )}
          {canAccessTracking && (
            <Link
              to="/orders/tracking"
              style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              title="Tracking numbers (Pack/Manager)"
            >
              🔢 Tracking
            </Link>
          )}
          <button
            type="button"
            onClick={handlePackingShortcut}
            disabled={!canUsePackingShortcut}
            style={canUsePackingShortcut ? btnPrimaryStyle : { ...btnStyle, opacity: 0.6, cursor: "not-allowed" }}
            title={canUsePackingShortcut ? "Today’s packing: shipping date = today, order status = Checked" : "Pack or Manager only"}
          >
            📦 Packing
          </button>
          <button type="button" onClick={() => fetchOrders()} style={btnStyle} title="Reload list">
            🔄 Refresh
          </button>
          <button type="button" onClick={handleLogout} style={{ ...btnStyle, color: "#f87171" }} title="Sign out">
            Logout
          </button>
        </div>
      </div>

      {/* Filters + Search */}
      <form
        style={filterBarStyle}
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
      >
        <input
          type="text"
          placeholder="Search order ID, name, phone, tracking"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ ...inputStyle, minWidth: 200 }}
        />
        <select
          value={orderStatus}
          onChange={(e) => setOrderStatus(e.target.value)}
          style={selectStyle}
        >
          <option value="">All order status</option>
          <option value="Pending">Pending</option>
          <option value="Checked">Checked</option>
          <option value="Packing">Packing</option>
          <option value="Shipped">Shipped</option>
          <option value="Success">Success</option>
          <option value="Fail">Fail</option>
          <option value="Return Received">Return Received</option>
        </select>
        <select
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value)}
          style={selectStyle}
        >
          <option value="">All payment status</option>
          <option value="Unchecked">Unchecked</option>
          <option value="Checked">Checked</option>
          <option value="Paid">Paid</option>
          <option value="Received">Received</option>
          <option value="Unmatched">Unmatched</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          style={selectStyle}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#ccc", fontSize: 14, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={hasAlert}
            onChange={(e) => setHasAlert(e.target.checked)}
          />
          Has alert
        </label>
        <button type="submit" style={btnPrimaryStyle}>
          Search
        </button>
        <button type="button" onClick={handleClearFilters} style={btnStyle}>
          Clear
        </button>
      </form>

      {error && (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            background: "#3b0000",
            color: "#ffcccc",
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: "#888" }}>Loading orders…</p>
      ) : (
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>No.</th>
                <th style={th}>Order ID</th>
                <th style={th}>Customer Name</th>
                <th style={th}>Order Status</th>
                <th style={th}>Payment Status</th>
                <th style={th}>Tracking</th>
                <th style={th}>Invoice</th>
                <th style={th}>Alert</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ ...td, textAlign: "center", color: "#888" }}>
                    No orders found.
                  </td>
                </tr>
              ) : (
                orders.map((rowData, index) => (
                  <tr
                    key={rowData.id}
                    style={rowStyle(rowData.id)}
                    onClick={() => openDetail(rowData.id)}
                    onMouseEnter={() => setHoveredRowId(rowData.id)}
                    onMouseLeave={() => setHoveredRowId(null)}
                  >
                    <td style={td}>{index + 1}</td>
                    <td style={td}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {rowData.order_code ?? "-"}
                        {(!rowData.shipping_date || String(rowData.shipping_date).trim() === "") && (
                          <span
                            title="ยังไม่ได้เลือกวันจัดส่ง"
                            style={{
                              display: "inline-flex",
                              color: "#22c55e",
                              fontSize: 16,
                              cursor: "help",
                              lineHeight: 1,
                            }}
                          >
                            ⚠
                          </span>
                        )}
                      </span>
                    </td>
                    <td style={td}>{rowData.customer_name ?? "-"}</td>
                    <td style={td}>
                      {rowData.order_status === "Pending" && "⌛Pending"}
                      {rowData.order_status === "Checked" && "✅Checked"}
                      {rowData.order_status === "Packing" && "📦Packing"}
                      {rowData.order_status === "Shipped" && "🚚Shipped"}
                      {!["Pending", "Checked", "Packing", "Shipped"].includes(rowData.order_status) &&
                        (rowData.order_status ?? "-")}
                    </td>
                    <td style={td}>{rowData.payment_status ?? "-"}</td>
                    <td style={td} onClick={(e) => e.stopPropagation()}>
                      {rowData.tracking_number?.trim() ? (
                        <a
                          href={`https://www.dhl.com/th-en/home/tracking.html?tracking-id=${encodeURIComponent(rowData.tracking_number.trim())}&submit=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#3b82f6", textDecoration: "none", fontSize: 14 }}
                        >
                          {rowData.tracking_number.trim()}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={td} onClick={(e) => e.stopPropagation()}>
                      {rowData.invoice_submit_file_url ? (
                        <a
                          href={rowData.invoice_submit_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#3b82f6", textDecoration: "none", fontSize: 14 }}
                        >
                          📄 View
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={td}>
                      {rowData.has_unread_alert ? alertIcon : "—"}
                    </td>
                  </tr>
                ))
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
          onReload={handleReload}
        />
      )}
    </div>
  );
}
