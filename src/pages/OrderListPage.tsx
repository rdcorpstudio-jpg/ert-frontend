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

  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  const fetchOrders = async (overrides?: {
    keyword?: string;
    order_status?: string;
    payment_status?: string;
    has_alert?: boolean;
    sort_by?: SortBy;
    shipping_date?: string;
    page?: number;
  }) => {
    const k = overrides?.keyword !== undefined ? overrides.keyword : keyword;
    const os = overrides?.order_status !== undefined ? overrides.order_status : orderStatus;
    const ps = overrides?.payment_status !== undefined ? overrides.payment_status : paymentStatus;
    const ha = overrides?.has_alert !== undefined ? overrides.has_alert : hasAlert;
    const sb = overrides?.sort_by !== undefined ? overrides.sort_by : sortBy;
    const sd = overrides?.shipping_date !== undefined ? overrides.shipping_date : shippingDate;
    const p = overrides?.page !== undefined ? overrides.page : page;
    const role = getUserRole();
    const params: Record<string, string | number | boolean | undefined> = {
      keyword: String(k).trim() || undefined,
      order_status: os || undefined,
      payment_status: ps || undefined,
      has_alert: ha || undefined,
      sort_by: sb,
      shipping_date: sd || undefined,
      limit: PAGE_SIZE,
      offset: (p - 1) * PAGE_SIZE,
    };
    if (role === "sale") params.only_my = true;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{ items: OrderRow[]; total: number }>("/orders", {
        params,
      });
      const list = data?.items ?? (Array.isArray(data) ? data : []);
      const total = typeof data?.total === "number" ? data.total : list.length;
      setOrders(Array.isArray(list) ? list : []);
      setTotalOrders(total);
      setPage(p);
    } catch (e) {
      setError("Failed to load orders.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [orderStatus, paymentStatus, sortBy, hasAlert, shippingDate]);

  // Fetch when filter, sort, shipping_date or page changes
  useEffect(() => {
    fetchOrders();
  }, [orderStatus, paymentStatus, sortBy, hasAlert, shippingDate, page]);

  const handleSearch = () => fetchOrders();

  const handleClearFilters = () => {
    setKeyword("");
    setOrderStatus("");
    setPaymentStatus("");
    setHasAlert(false);
    setShippingDate("");
    setSortBy("newest");
    setPage(1);
    // useEffect will refetch when state updates
  };

  const totalPages = Math.max(1, Math.ceil(totalOrders / PAGE_SIZE));
  const pageNumbers: number[] = [];
  const showPages = 5;
  let startPage = Math.max(1, page - Math.floor(showPages / 2));
  if (startPage + showPages - 1 > totalPages) startPage = Math.max(1, totalPages - showPages + 1);
  for (let i = 0; i < showPages && startPage + i <= totalPages; i++) {
    pageNumbers.push(startPage + i);
  }

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
  const role = getUserRole();
  const canUsePackingShortcut = role === "pack" || role === "manager";
  const canAccessAccountant = role === "account" || role === "manager";
  const canAccessTracking = role === "pack" || role === "manager";

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
          {(role === "sale" || role === "manager") && (
            <Link
              to="/orders/create"
              style={{
                ...btnPrimaryStyle,
                textDecoration: "none",
              }}
            >
              + Create Order
            </Link>
          )}
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
              <Link
                to="/dashboard"
                style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                title="Revenue by status dashboard"
              >
                📊 Dashboard
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
          {role === "sale" ? (
            <Link
              to="/sale-summary"
              style={{ ...btnPrimaryStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              title="Sale Summary"
            >
              📈 Sale Summary
            </Link>
          ) : (
            <button
              type="button"
              onClick={handlePackingShortcut}
              disabled={!canUsePackingShortcut}
              style={canUsePackingShortcut ? btnPrimaryStyle : { ...btnStyle, opacity: 0.6, cursor: "not-allowed" }}
              title={canUsePackingShortcut ? "Today’s packing: shipping date = today, order status = Checked" : "Pack or Manager only"}
            >
              📦 Packing
            </button>
          )}
          <button type="button" onClick={() => fetchOrders()} style={btnStyle} title="Reload list">
            🔄 Refresh
          </button>
          <Link
            to="/menu"
            style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
            title="Back to menu"
          >
            ← Menu
          </Link>
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
          <option value="Special">Special</option>
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
        <>
        <div style={{ marginBottom: 12, fontSize: 13, color: "#999" }}>
          {totalOrders === 0
            ? "No orders"
            : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalOrders)} of ${totalOrders} orders`}
        </div>
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
                    <td style={td}>{(page - 1) * PAGE_SIZE + index + 1}</td>
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
                      {rowData.order_status === "Special" && "🚗Special"}
                      {!["Pending", "Checked", "Packing", "Shipped", "Special"].includes(rowData.order_status) &&
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
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{ ...btnStyle, padding: "8px 12px" }}
            >
              ← Prev
            </button>
            {pageNumbers.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                style={{
                  ...(n === page ? btnPrimaryStyle : btnStyle),
                  padding: "8px 12px",
                  minWidth: 36,
                }}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{ ...btnStyle, padding: "8px 12px" }}
            >
              Next →
            </button>
          </div>
        )}
        </>
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
