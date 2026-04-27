import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { fetchOrdersAllPages } from "../services/ordersList";
import OrderDetailModal, { type OrderDetail } from "../components/OrderDetailModal";

type OrderRow = {
  id: number;
  order_code: string;
  sale_name?: string | null;
  customer_name: string | null;
  shipping_note?: string | null;
  order_status: string;
  payment_status: string;
  has_unread_alert?: boolean;
  main_product_name?: string | null;
};

const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const PRODUCT_CATEGORY_ORDER = ["M", "L", "Full", "ผ้าห่ม", "Red Light", "etc."];
function sortCategoriesByOrder(cats: string[]): string[] {
  const order = new Map(PRODUCT_CATEGORY_ORDER.map((c, i) => [c, i]));
  return [...cats].sort((a, b) => {
    const ia = order.has(a) ? order.get(a)! : 999;
    const ib = order.has(b) ? order.get(b)! : 999;
    return ia - ib;
  });
}

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

export default function PackingPage() {
  const role = getUserRole();
  const canAccess = role === "pack" || role === "manager";

  const [pendingOrders, setPendingOrders] = useState<OrderRow[]>([]);
  const [checkedOrders, setCheckedOrders] = useState<OrderRow[]>([]);
  const [packingOrders, setPackingOrders] = useState<OrderRow[]>([]);
  const [shippedOrders, setShippedOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!canAccess) return;
    api.get<Array<{ category?: string | null }>>("/products").then((res) => {
      const list = Array.isArray(res.data) ? res.data : [];
      const cats = [...new Set(list.map((p) => p.category).filter(Boolean) as string[])];
      setProductCategories(sortCategoriesByOrder(cats));
    }).catch(() => setProductCategories([]));
  }, [canAccess]);

  const buildParams = (orderStatus: string): Record<string, string | string[] | undefined> => {
    const today = todayStr();
    const o: Record<string, string | string[] | undefined> = {
      shipping_date: today,
      sort_by: "oldest",
      order_status: orderStatus,
      shipping_method: "Normal",
    };
    if (selectedCategories.length) o.product_category = [...selectedCategories];
    if (selectedPaymentMethods.length) o.payment_method = [...selectedPaymentMethods];
    return o;
  };

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchOrdersAllPages<OrderRow>(buildParams("Pending")),
      fetchOrdersAllPages<OrderRow>(buildParams("Checked")),
      fetchOrdersAllPages<OrderRow>(buildParams("Packing")),
      fetchOrdersAllPages<OrderRow>(buildParams("Shipped")),
    ])
      .then(([a, b, c, d]) => {
        if (cancelled) return;
        setPendingOrders(a);
        setCheckedOrders(b);
        setPackingOrders(c);
        setShippedOrders(d);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load orders.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canAccess, selectedCategories, selectedPaymentMethods]);

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
      const [a, b, c, d] = await Promise.all([
        fetchOrdersAllPages<OrderRow>(buildParams("Pending")),
        fetchOrdersAllPages<OrderRow>(buildParams("Checked")),
        fetchOrdersAllPages<OrderRow>(buildParams("Packing")),
        fetchOrdersAllPages<OrderRow>(buildParams("Shipped")),
      ]);
      setPendingOrders(a);
      setCheckedOrders(b);
      setPackingOrders(c);
      setShippedOrders(d);
    } catch {
      setError("Failed to reload.");
    }
  };

  if (!canAccess) {
    return (
      <div style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
        <p style={{ color: "#f59e0b" }}>Only Pack or Manager can access this page.</p>
        <Link to="/orders" style={{ color: "#60a5fa" }}>← Back to Order List</Link>
      </div>
    );
  }

  const columnStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 280,
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

  const renderTable = (title: string, orders: OrderRow[]) => (
    <div style={columnStyle}>
      <div style={headerStyle}>
        {title}
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
                <th style={thStyle}>Main product name</th>
                <th style={thStyle}>Alert</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "#666" }}>
                    No orders
                  </td>
                </tr>
              ) : (
                orders.map((row) => {
                  const hasShippingNote = !!(row.shipping_note && row.shipping_note.trim().length > 0);
                  return (
                  <tr
                    key={row.id}
                    style={{
                      cursor: "pointer",
                      background: hasShippingNote ? "#3b1f1f" : undefined,
                    }}
                    onClick={() => openDetail(row.id)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = hasShippingNote ? "#4b2727" : "#252525";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = hasShippingNote ? "#3b1f1f" : "";
                    }}
                  >
                    <td style={tdStyle}>{row.order_code ?? "-"}</td>
                    <td style={tdStyle}>{row.sale_name ?? "-"}</td>
                    <td style={tdStyle}>
                      {row.customer_name ?? "-"}
                      {hasShippingNote && (
                        <span
                          style={{
                            marginLeft: 6,
                            padding: "2px 6px",
                            borderRadius: 6,
                            background: "#f59e0b",
                            color: "#111827",
                            fontSize: 11,
                          }}
                        >
                          มีหมายเหตุ
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>{row.main_product_name ?? "-"}</td>
                    <td style={tdStyle}>{row.has_unread_alert ? "⚠️" : "—"}</td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Today’s Packing — {todayStr()}</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link
            to="/orders/check-cod"
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "1px solid #10b981",
              background: "#10b981",
              color: "#0f172a",
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            💰 Check COD
          </Link>
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
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, marginBottom: 16, background: "#3b0000", color: "#fcc", borderRadius: 8 }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>Product category (multi-select)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            onClick={() => setSelectedCategories([])}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #555",
              background: selectedCategories.length === 0 ? "#2563eb" : "#333",
              color: "#eee",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            All
          </button>
          {productCategories.map((cat) => {
            const isSelected = selectedCategories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategories((prev) =>
                    isSelected ? prev.filter((c) => c !== cat) : [...prev, cat]
                  );
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #555",
                  background: isSelected ? "#2563eb" : "#333",
                  color: "#eee",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>Payment method (multi-select)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {[
            { value: "all", label: "All" },
            { value: "cod", label: "ปลายทาง (COD)" },
            { value: "deposit_cod", label: "มัดจำ + ปลายทาง (Deposit + COD)" },
            { value: "deposit_transfer", label: "มัดจำ + โอน" },
            { value: "deposit_card_2c2p", label: "มัดจำ + บัตร 2C2P" },
            { value: "deposit_card_pay", label: "มัดจำ + บัตร PAY" },
            { value: "transfer", label: "โอน" },
            { value: "card_2c2p", label: "บัตร 2C2P" },
            { value: "card_pay", label: "บัตร PAY" },
          ].map(({ value, label }) => {
            const isAll = value === "all";
            const isSelected = isAll ? selectedPaymentMethods.length === 0 : selectedPaymentMethods.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  if (isAll) setSelectedPaymentMethods([]);
                  else {
                    setSelectedPaymentMethods((prev) =>
                      isSelected ? prev.filter((m) => m !== value) : [...prev, value]
                    );
                  }
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #555",
                  background: isSelected ? "#2563eb" : "#333",
                  color: "#eee",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        {renderTable("Pending", pendingOrders)}
        {renderTable("Checked", checkedOrders)}
        {renderTable("Packing", packingOrders)}
        {renderTable("Shipped", shippedOrders)}
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
