import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
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
  pageName?: string | null;
  invoice_number?: string | null;
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

const PAGE_SIZE = 50;

/** List filter: any of these counts as "already sent / outbound" for reporting */
const ORDER_STATUS_SHIPPED_OUT = "__shipped_special_success__";
const SHIPPED_OUT_STATUSES = ["Shipped", "Special", "Success"] as const;

export default function OrderListPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filters & sort
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [noShippingDateOnly, setNoShippingDateOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [shippingDate, setShippingDate] = useState(""); // YYYY-MM-DD for filter
  const [createdFrom, setCreatedFrom] = useState(""); // YYYY-MM-DD — order created_at
  const [createdTo, setCreatedTo] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 350);
    return () => window.clearTimeout(t);
  }, [keyword]);

  const prevDebouncedRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevDebouncedRef.current === undefined) {
      prevDebouncedRef.current = debouncedKeyword;
      return;
    }
    if (prevDebouncedRef.current !== debouncedKeyword) {
      setPage(1);
      prevDebouncedRef.current = debouncedKeyword;
    }
  }, [debouncedKeyword]);

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

  const loadOrders = useCallback(async () => {
    const role = getUserRole();
    const params: Record<string, string | boolean | number | string[] | undefined> = {
      page,
      page_size: PAGE_SIZE,
      keyword: debouncedKeyword || undefined,
      payment_status: paymentStatus || undefined,
      missing_shipping_date: noShippingDateOnly || undefined,
      sort_by: sortBy,
      shipping_date: shippingDate || undefined,
      created_from: createdFrom || undefined,
      created_to: createdTo || undefined,
    };
    if (orderStatus === ORDER_STATUS_SHIPPED_OUT) {
      params.order_status_in = [...SHIPPED_OUT_STATUSES];
    } else if (orderStatus) {
      params.order_status = orderStatus;
    }
    if (role === "sale") params.only_my = true;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{
        items: OrderRow[];
        total: number;
        page: number;
        page_size: number;
      }>("/orders", { params });
      setOrders(Array.isArray(data.items) ? data.items : []);
      setTotal(typeof data.total === "number" ? data.total : 0);
    } catch {
      setError("Failed to load orders.");
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    debouncedKeyword,
    orderStatus,
    paymentStatus,
    sortBy,
    noShippingDateOnly,
    shippingDate,
    createdFrom,
    createdTo,
  ]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > tp) setPage(tp);
  }, [total, page]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const k = keyword.trim();
    setDebouncedKeyword(k);
    setPage(1);
    prevDebouncedRef.current = k;
  };

  const handleClearFilters = () => {
    setKeyword("");
    setDebouncedKeyword("");
    prevDebouncedRef.current = "";
    setOrderStatus("");
    setPaymentStatus("");
    setNoShippingDateOnly(false);
    setShippingDate("");
    setCreatedFrom("");
    setCreatedTo("");
    setSortBy("newest");
    setPage(1);
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
      await loadOrders();
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* Manager: see links to all main pages */}
          {role === "manager" && (
            <>
              <Link
                to="/orders/create"
                style={{ ...btnPrimaryStyle, textDecoration: "none" }}
              >
                + Create Order
              </Link>
              <Link
                to="/sale-summary"
                style={{ ...btnPrimaryStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                📈 Sale Summary
              </Link>
              <Link
                to="/orders/accountant"
                style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                📒 เช็คยอด
              </Link>
              <Link
                to="/orders/invoice-number"
                style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                🔢 กรอกเลข Invoice
              </Link>
              <Link
                to="/orders/invoice-submit"
                style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                📄 อัพโหลด Invoice ให้ลูกค้า
              </Link>
              <Link
                to="/dashboard"
                style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                📊 Dashboard
              </Link>
              <Link
                to="/orders/packing"
                style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                📦 Packing
              </Link>
              <Link
                to="/orders/check-cod"
                style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                💰 Check COD
              </Link>
              <Link
                to="/orders/tracking"
                style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                🔢 Tracking
              </Link>
              <Link
                to="/dev"
                style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                ⚙️ Dev
              </Link>
              <Link
                to="/line-notification-setup"
                style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
              >
                💬 Line Noti
              </Link>
            </>
          )}

          {/* Non-manager roles keep their existing menus */}
          {role !== "manager" && (
            <>
              {(role === "sale") && (
                <Link
                  to="/orders/create"
                  style={{ ...btnPrimaryStyle, textDecoration: "none" }}
                >
                  + Create Order
                </Link>
              )}
              {canAccessAccountant && (
                <Link
                  to="/orders/accountant"
                  style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                >
                  📒 Accountant
                </Link>
              )}
              {(role === "pack" || role === "manager") && (
                <Link
                  to="/orders/check-cod"
                  style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                >
                  💰 Check COD
                </Link>
              )}
              {canAccessTracking && (
                <Link
                  to="/orders/tracking"
                  style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                >
                  🔢 Tracking
                </Link>
              )}
              {role === "sale" ? (
                <Link
                  to="/sale-summary"
                  style={{ ...btnPrimaryStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                >
                  📈 Sale Summary
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handlePackingShortcut}
                  disabled={!canUsePackingShortcut}
                  style={canUsePackingShortcut ? btnPrimaryStyle : { ...btnStyle, opacity: 0.6, cursor: "not-allowed" }}
                >
                  📦 Packing
                </button>
              )}
            </>
          )}
          <button type="button" onClick={() => void loadOrders()} style={btnStyle} title="Reload list">
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
      <form style={filterBarStyle} onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Search order ID, name, phone, tracking"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={{ ...inputStyle, minWidth: 200 }}
        />
        <select
          value={orderStatus}
          onChange={(e) => {
            setOrderStatus(e.target.value);
            setPage(1);
          }}
          style={selectStyle}
        >
          <option value="">All order status</option>
          <option value="Pending">Pending</option>
          <option value="Checked">Checked</option>
          <option value="Packing">Packing</option>
          <option value="Shipped">Shipped</option>
          <option value="Special">Special</option>
          <option value="Success">Success</option>
          <option value={ORDER_STATUS_SHIPPED_OUT}>
            Shipped + Special + Success (ส่งออกแล้ว)
          </option>
          <option value="Fail">Fail</option>
          <option value="Return Received">Return Received</option>
        </select>
        <select
          value={paymentStatus}
          onChange={(e) => {
            setPaymentStatus(e.target.value);
            setPage(1);
          }}
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
            checked={noShippingDateOnly}
            onChange={(e) => {
              setNoShippingDateOnly(e.target.checked);
              setPage(1);
            }}
          />
          No shipping date
        </label>
        <span style={{ color: "#9ca3af", fontSize: 13, whiteSpace: "nowrap" }}>สร้างออเดอร์</span>
        <input
          type="date"
          value={createdFrom}
          onChange={(e) => {
            setCreatedFrom(e.target.value);
            setPage(1);
          }}
          title="วันที่สร้างออเดอร์ — ตั้งแต่"
          style={{ ...inputStyle, minWidth: 150 }}
        />
        <span style={{ color: "#9ca3af", fontSize: 13 }}>–</span>
        <input
          type="date"
          value={createdTo}
          onChange={(e) => {
            setCreatedTo(e.target.value);
            setPage(1);
          }}
          title="วันที่สร้างออเดอร์ — ถึง"
          style={{ ...inputStyle, minWidth: 150 }}
        />
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
                  <th style={th}>Page</th>
                  <th style={th}>Order Status</th>
                  <th style={th}>Payment Status</th>
                  <th style={th}>Tracking</th>
                  <th style={th}>Invoice Number</th>
                  <th style={th}>Invoice File</th>
                  <th style={th}>Alert</th>
                </tr>
              </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ ...td, textAlign: "center", color: "#888" }}>
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
                    <td style={td}>{rowData.pageName ?? "-"}</td>
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
                    <td style={td}>{rowData.invoice_number ?? "—"}</td>
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

      {!loading && total > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 16,
            color: "#ccc",
            fontSize: 14,
          }}
        >
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min((page - 1) * PAGE_SIZE + orders.length, total)} of {total}
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={page <= 1 ? { ...btnStyle, opacity: 0.5, cursor: "not-allowed" } : btnStyle}
            >
              Previous
            </button>
            <span style={{ minWidth: 120, textAlign: "center" }}>
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              style={page >= totalPages ? { ...btnStyle, opacity: 0.5, cursor: "not-allowed" } : btnStyle}
            >
              Next
            </button>
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
