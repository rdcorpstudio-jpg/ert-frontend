import { useState, useEffect } from "react";
import api from "../services/api";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type OrderDetail = {
  order: {
    id: number;
    order_code: string;
    order_status?: string;
    customer_name: string | null;
    customer_phone: string | null;
    shipping_address_text: string | null;
    shipping_note: string | null;
    [key: string]: unknown;
  };
  payment: {
    payment_method: string | null;
    payment_status: string;
    paid_date: string | null;
    paid_note: string | null;
    installment_type?: string | null;
    installment_months?: number | null;
    [key: string]: unknown;
  } | null;
  items: Array<{
    id: number;
    product_id?: number;
    product_name: string;
    unit_price: number | string;
    discount: number | string;
    freebies?: Array<{ id: number; freebie_name?: string | null; [key: string]: unknown }>;
  }>;
  order_freebies?: Array<{ id: number; freebie_id: number; freebie_name: string | null }>;
  net_total: number;
  /** Main product editable: Pending; or Checked/Packing when net total unchanged; never after Shipped */
  product_editable?: boolean;
  files: Array<{ id?: number; file_type: string; file_url: string; [key: string]: unknown }>;
  alerts: Array<{ id: number; message: string; is_read: boolean; target_role?: string; [key: string]: unknown }>;
  [key: string]: unknown;
};

type Props = {
  orderId: number;
  detail: OrderDetail | null;
  detailLoading: boolean;
  onClose: () => void;
  onReload: () => void;
};

// Allowed next statuses for manual change. Pending→Checked is NOT here: "Checked" is set only when accountant sets payment status to Checked (sync). From Checked onward, pack/manager can step.
const ORDER_STATUS_FLOW: Record<string, string[]> = {
  Pending: [], // do not allow manual change to Checked; sync from payment status only
  Checked: ["Packing"],
  Packing: ["Shipped", "Fail"],
  Shipped: ["Success", "Fail"],
  Fail: ["Return Received"],
  "Return Received": [],
  Success: [],
  Special: [], // own-fleet; packing cannot change; account manages payment only
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

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getFileByType(files: OrderDetail["files"] | undefined, type: string) {
  return files?.find((f) => f.file_type === type);
}

function getFilesByType(files: OrderDetail["files"] | undefined, type: string) {
  return files?.filter((f) => f.file_type === type) ?? [];
}

// -----------------------------------------------------------------------------
// Modal component
// -----------------------------------------------------------------------------

export default function OrderDetailModal({
  orderId,
  detail,
  detailLoading,
  onClose,
  onReload,
}: Props) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingNote, setShippingNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [installmentType, setInstallmentType] = useState("");
  const [installmentMonths, setInstallmentMonths] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<string>("");
  const [paidDate, setPaidDate] = useState("");
  const [paidNote, setPaidNote] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savingShipping, setSavingShipping] = useState(false);
  const [savingPaymentMethod, setSavingPaymentMethod] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [products, setProducts] = useState<Array<{ id: number; name: string; price: number }>>([]);
  const [savingItemId, setSavingItemId] = useState<number | null>(null);
  const [savingDiscountItemId, setSavingDiscountItemId] = useState<number | null>(null);
  const [freebieNote, setFreebieNote] = useState("");
  const [savingFreebieNote, setSavingFreebieNote] = useState(false);
  const [shippingDate, setShippingDate] = useState("");
  const [savingShippingDate, setSavingShippingDate] = useState(false);
  const [invoiceRequired, setInvoiceRequired] = useState(false);
  const [invoiceText, setInvoiceText] = useState("");
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [savingOrderStatus, setSavingOrderStatus] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  type TabId = "overview" | "customer" | "order" | "payment" | "manager";
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const userRole = getUserRole();
  const isManager = userRole === "manager";
  const tabList: TabId[] = isManager
    ? ["overview", "customer", "order", "payment", "manager"]
    : ["overview", "customer", "order", "payment"];

  const order = detail?.order;
  const payment = detail?.payment;
  const files = detail?.files ?? [];
  const alerts = detail?.alerts ?? [];
  const items = detail?.items ?? [];
  const orderFreebies = detail?.order_freebies ?? [];
  const netTotal = detail?.net_total ?? 0;
  const productEditable = detail?.product_editable ?? false;
  // Display name of the User (sale) who created this order — should match that user's name exactly
  const saleName =
    (detail as { sale_name?: string | null })?.sale_name ??
    (order as { sale_name?: string | null })?.sale_name ??
    (detail as { sale_user_name?: string | null })?.sale_user_name ??
    (order as { sale_user_name?: string | null })?.sale_user_name ??
    (detail as { created_by_name?: string | null })?.created_by_name ??
    (order as { created_by_name?: string | null })?.created_by_name ??
    null;

  // Backend rule: shipping/customer editable only when status is Pending or Checked (manager can always edit on backend; we disable by status in UI)
  const orderStatus = order?.order_status ?? "";
  const canEditShippingAndCustomer =
    orderStatus === "Pending" || orderStatus === "Checked";
  // Order status change: only pack/manager; blocked only by unread alerts targeting current role (sale-targeted e.g. INVOICE_SUBMITTED do not block pack)
  const hasUnreadAlerts = alerts.some((a) => !a.is_read);
  const hasUnreadAlertsForMyRole = alerts.some((a) => !a.is_read && (a.target_role ?? "") === userRole);
  const allowedNextStatuses = ORDER_STATUS_FLOW[orderStatus] ?? [];
  const canChangeOrderStatus =
    (userRole === "pack" || userRole === "manager") &&
    !hasUnreadAlertsForMyRole &&
    allowedNextStatuses.length > 0;
  // Freebie note editable when order status is not Shipped or above (Pending, Checked, Packing)
  const canEditFreebieNote =
    !["Shipped", "Success", "Fail", "Return Received"].includes(orderStatus);
  // Discount % editable only when order status is Pending
  const canEditDiscount = orderStatus === "Pending";
  // Payment method editable only when payment status is Unchecked (use saved value from detail)
  const canEditPaymentMethod = (detail?.payment?.payment_status ?? "Unchecked") === "Unchecked";

  useEffect(() => {
    if (order) {
      setCustomerName(order.customer_name ?? "");
      setCustomerPhone(order.customer_phone ?? "");
      setShippingAddress(order.shipping_address_text ?? "");
      setShippingNote(order.shipping_note ?? "");
      setFreebieNote(String((order as { note?: string | null }).note ?? ""));
      const sd = (order as { shipping_date?: string | null }).shipping_date;
      setShippingDate(sd ? String(sd).slice(0, 10) : "");
      const invReq = (order as { invoice_required?: boolean }).invoice_required;
      const invTxt = (order as { invoice_text?: string | null }).invoice_text;
      setInvoiceRequired(Boolean(invReq) || Boolean(String(invTxt ?? "").trim()));
      setInvoiceText(String(invTxt ?? ""));
      setTrackingNumber(String((order as { tracking_number?: string | null }).tracking_number ?? ""));
    }
  }, [order]);

  useEffect(() => {
    if (payment) {
      setPaymentMethod(payment.payment_method ?? "");
      setInstallmentType((payment as { installment_type?: string | null }).installment_type ?? "");
      setInstallmentMonths(
        (payment as { installment_months?: number | null }).installment_months != null
          ? String((payment as { installment_months?: number | null }).installment_months)
          : ""
      );
      setPaymentStatus(payment.payment_status ?? "Unchecked");
      setPaidDate(
        payment.paid_date
          ? String(payment.paid_date).slice(0, 10)
          : ""
      );
      setPaidNote(String(payment.paid_note ?? ""));
    }
  }, [payment]);

  useEffect(() => {
    if (productEditable) {
      api.get("/products").then((res) => setProducts(res.data ?? [])).catch(() => setProducts([]));
    } else {
      setProducts([]);
    }
  }, [productEditable]);

  const handleSavePaymentStatus = async () => {
    if (!detail?.order?.id) return;
    if (!window.confirm(`Change payment status to "${paymentStatus}"?`)) return;
    setSavingPayment(true);
    try {
      await api.put(`/orders/${detail.order.id}/payment-status`, null, {
        params: {
          new_status: paymentStatus,
          paid_date: paymentStatus === "Paid" ? paidDate || null : null,
          paid_note: paymentStatus === "Paid" ? paidNote || null : null,
        },
      });
      await onReload();
    } catch {
      alert("Failed to update payment status.");
    } finally {
      setSavingPayment(false);
    }
  };

  const markAlertRead = async (alertId: number) => {
    try {
      await api.put(`/orders/alerts/${alertId}/read`);
      await onReload();
    } catch {
      alert("Failed to mark alert as read.");
    }
  };

  const handleChangeOrderStatus = async (newStatus: string) => {
    if (!detail?.order?.id) return;
    if (!window.confirm(`Change order status to "${newStatus}"?`)) return;
    setSavingOrderStatus(true);
    try {
      await api.put(`/orders/${detail.order.id}/status`, null, {
        params: { new_status: newStatus },
      });
      await onReload();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e && typeof (e as { response?: { data?: { detail?: string } } }).response?.data?.detail === "string"
          ? (e as { response: { data: { detail: string } } }).response.data.detail
          : "Failed to change order status.";
      alert(msg);
    } finally {
      setSavingOrderStatus(false);
    }
  };

  const handleSaveCustomer = async () => {
    if (!detail?.order?.id) return;
    setSavingCustomer(true);
    try {
      await api.put(`/orders/${detail.order.id}/customer`, null, {
        params: { customer_name: customerName, customer_phone: customerPhone },
      });
      await onReload();
    } catch {
      alert("Failed to update customer.");
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleSaveShipping = async () => {
    if (!detail?.order?.id) return;
    const originalAddress = order?.shipping_address_text ?? "";
    const originalNote = order?.shipping_note ?? "";
    const addressChanged = shippingAddress !== originalAddress;
    const noteChanged = shippingNote !== originalNote;
    if (!addressChanged && !noteChanged) return;
    setSavingShipping(true);
    try {
      if (addressChanged) {
        await api.put(`/orders/${detail.order.id}/address`, null, {
          params: { new_address: shippingAddress },
        });
      }
      if (noteChanged) {
        await api.put(`/orders/${detail.order.id}/shipping-note`, null, {
          params: { new_note: shippingNote },
        });
      }
      await onReload();
    } catch {
      alert("Failed to update shipping info.");
    } finally {
      setSavingShipping(false);
    }
  };

  const handleSaveShippingDate = async () => {
    if (!detail?.order?.id) return;
    const original = (order as { shipping_date?: string | null })?.shipping_date ?? "";
    const newVal = shippingDate.trim() ? shippingDate.slice(0, 10) : "";
    if (newVal === (original ? String(original).slice(0, 10) : "")) return;
    setSavingShippingDate(true);
    try {
      await api.put(`/orders/${detail.order.id}/shipping-date`, null, {
        params: newVal ? { new_shipping_date: newVal } : {},
      });
      await onReload();
    } catch {
      alert("Failed to update shipping date.");
    } finally {
      setSavingShippingDate(false);
    }
  };

  const handleSaveFreebieNote = async () => {
    if (!detail?.order?.id) return;
    const originalNote = (order as { note?: string | null })?.note ?? "";
    if (freebieNote === originalNote) return;
    setSavingFreebieNote(true);
    try {
      await api.put(`/orders/${detail.order.id}/note`, null, {
        params: { new_note: freebieNote },
      });
      await onReload();
    } catch {
      alert("Failed to update freebie note.");
    } finally {
      setSavingFreebieNote(false);
    }
  };

  const handleSaveInvoice = async () => {
    if (!detail?.order?.id) return;
    const o = order as { invoice_required?: boolean; invoice_text?: string | null };
    if (o?.invoice_required === invoiceRequired && (o?.invoice_text ?? "") === invoiceText) return;
    setSavingInvoice(true);
    try {
      await api.put(`/orders/${detail.order.id}/invoice`, null, {
        params: {
          invoice_required: invoiceRequired,
          invoice_text: invoiceRequired ? invoiceText : null,
        },
      });
      await onReload();
    } catch {
      alert("Failed to update invoice request.");
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleSavePaymentMethod = async () => {
    if (!detail?.order?.id) return;
    setSavingPaymentMethod(true);
    try {
      await api.put(`/orders/${detail.order.id}/payment-method`, null, {
        params: {
          payment_method: paymentMethod,
          installment_type: (paymentMethod === "card_2c2p" || paymentMethod === "card_pay") ? (installmentType || null) : null,
          installment_months: (paymentMethod === "card_2c2p" || paymentMethod === "card_pay") && installmentType === "installment"
            ? (installmentMonths ? Number(installmentMonths) : null)
            : null,
        },
      });
      await onReload();
    } catch {
      alert("Failed to update payment method.");
    } finally {
      setSavingPaymentMethod(false);
    }
  };

  const discountOptionFromAmount = (unitPrice: number, discountAmount: number): string => {
    const d = Number(discountAmount);
    const u = Number(unitPrice);
    if (d < 0.01) return "";
    if (u >= 0.01) {
      const r = d / u;
      if (Math.abs(r - 0.05) < 0.001) return "5";
      if (Math.abs(r - 0.1) < 0.001) return "10";
      if (Math.abs(r - 0.15) < 0.001) return "15";
      if (Math.abs(r - 0.2) < 0.001) return "20";
    }
    if (d >= 999 && d <= 1001) return "1000";
    return "";
  };

  const discountAmountFromOption = (unitPrice: number, option: string): number => {
    const u = Number(unitPrice);
    if (option === "" || option === "0") return 0;
    if (option === "5") return u * 0.05;
    if (option === "10") return u * 0.1;
    if (option === "15") return u * 0.15;
    if (option === "20") return u * 0.2;
    if (option === "1000") return 1000;
    return 0;
  };

  const handleChangeDiscount = async (orderItemId: number, newDiscountAmount: number, currentDiscount: number) => {
    if (Math.abs(newDiscountAmount - currentDiscount) < 0.01) return;
    setSavingDiscountItemId(orderItemId);
    try {
      await api.put(`/orders/items/${orderItemId}/discount`, null, {
        params: { discount: newDiscountAmount },
      });
      await onReload();
    } catch (e: unknown) {
      const msg =
        e &&
        typeof e === "object" &&
        "response" in e &&
        typeof (e as { response?: { data?: { detail?: string } } }).response?.data?.detail === "string"
          ? (e as { response: { data: { detail: string } } }).response.data.detail
          : "Failed to update discount.";
      alert(msg);
    } finally {
      setSavingDiscountItemId(null);
    }
  };

  const handleChangeMainProduct = async (orderItemId: number, newProductId: number, currentProductId: number) => {
    if (newProductId === 0 || newProductId === currentProductId) return;
    setSavingItemId(orderItemId);
    try {
      await api.put(`/orders/items/${orderItemId}`, null, {
        params: { product_id: newProductId },
      });
      await onReload();
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "response" in e && typeof (e as { response?: { data?: { detail?: string } } }).response?.data?.detail === "string"
        ? (e as { response: { data: { detail: string } } }).response.data.detail
        : "Failed to update product.";
      alert(msg);
    } finally {
      setSavingItemId(null);
    }
  };

  // Styles
  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 24,
  };

  const box: React.CSSProperties = {
    background: "#222",
    borderRadius: 12,
    maxWidth: 640,
    width: "100%",
    maxHeight: "90vh",
    overflowY: "auto",
    padding: 24,
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 600,
    marginTop: 20,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottom: "1px solid #444",
    color: "#fff",
  };

  const label: React.CSSProperties = { color: "#aaa", fontSize: 12, marginBottom: 4 };
  const value: React.CSSProperties = { color: "#eee", marginBottom: 12 };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    marginBottom: 8,
    background: "#333",
    border: "1px solid #555",
    borderRadius: 8,
    color: "#eee",
    fontSize: 14,
    boxSizing: "border-box",
  };
  const saveBtn: React.CSSProperties = {
    padding: "6px 12px",
    marginTop: 4,
    background: "#2563eb",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
  };
  const linkBtn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    marginRight: 8,
    marginBottom: 8,
    background: "#333",
    border: "1px solid #555",
    borderRadius: 8,
    color: "#eee",
    cursor: "pointer",
    fontSize: 13,
    textDecoration: "none",
  };

  // Color helpers: editable vs read-only by status rule
  const editableBadge: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    background: "rgba(34, 197, 94, 0.2)",
    color: "#22c55e",
    border: "1px solid rgba(34, 197, 94, 0.4)",
  };
  const readOnlyBadge: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    background: "rgba(107, 114, 128, 0.25)",
    color: "#9ca3af",
    border: "1px solid rgba(107, 114, 128, 0.4)",
  };
  const editableBlockWrap: React.CSSProperties = {
    padding: "12px 14px",
    borderRadius: 8,
    borderLeft: "4px solid #22c55e",
    background: "rgba(34, 197, 94, 0.06)",
  };
  const readOnlyBlockWrap: React.CSSProperties = {
    padding: "12px 14px",
    borderRadius: 8,
    borderLeft: "4px solid #6b7280",
    background: "rgba(107, 114, 128, 0.08)",
  };

  if (detailLoading && !detail) {
    return (
      <div style={overlay} onClick={onClose}>
        <div style={box} onClick={(e) => e.stopPropagation()}>
          <p style={{ color: "#888" }}>Loading order details…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: "#fff" }}>
            Order {order?.order_code ?? orderId}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#aaa",
              cursor: "pointer",
              fontSize: 20,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Alerts — always visible above tabs */}
        <div style={{ marginBottom: 16 }}>
          <div style={sectionTitle}>Alerts</div>
          {alerts.length === 0 ? (
            <p style={{ ...value, color: "#666" }}>No alerts for this order.</p>
          ) : (
            <>
              {hasUnreadAlerts && (
                <p style={{ fontSize: 12, color: "#f59e0b", marginBottom: 8 }}>
                  Order status cannot be changed until all alerts have been acknowledged.
                </p>
              )}
              <div style={{ background: "#2a1a1a", padding: 12, borderRadius: 8 }}>
                {alerts.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                      paddingBottom: 8,
                      borderBottom: "1px solid #3a2a2a",
                    }}
                  >
                    <span style={{ color: "#fcc" }}>⚠ {a.message}</span>
                    <button
                      type="button"
                      onClick={() => markAlertRead(a.id)}
                      style={{
                        padding: "4px 10px",
                        background: "#444",
                        border: "none",
                        borderRadius: 6,
                        color: "#eee",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Acknowledge
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap", borderBottom: "1px solid #444", paddingBottom: 12 }}>
          {tabList.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "8px 14px",
                background: activeTab === tab ? "#2563eb" : "#333",
                border: "1px solid #555",
                borderRadius: 8,
                color: "#eee",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: activeTab === tab ? 600 : 400,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {tab === "overview" && "Overview"}
              {tab === "customer" && "Customer"}
              {tab === "order" && "Order details"}
              {tab === "payment" && "Payment"}
              {tab === "manager" && "Manager"}
              {tab === "overview" && hasUnreadAlerts && (
                <span style={{ background: "#f59e0b", color: "#000", padding: "2px 6px", borderRadius: 10, fontSize: 11 }}>
                  Unread alerts
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {activeTab === "overview" && (
          <div style={{ marginBottom: 16 }}>
            <div style={sectionTitle}>Order status</div>
            <div style={label}>Current status</div>
            <div style={{ ...value, marginBottom: 8 }}>{orderStatus === "Special" ? "🚗 Special" : (orderStatus || "—")}</div>
            {canChangeOrderStatus ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 16 }}>
                {allowedNextStatuses.map((next: string) => (
                  <button
                    key={next}
                    type="button"
                    onClick={() => handleChangeOrderStatus(next)}
                    disabled={savingOrderStatus}
                    style={{
                      ...saveBtn,
                      background: next === "Fail" ? "#b91c1c" : "#2563eb",
                    }}
                  >
                    {savingOrderStatus ? "Updating…" : `→ ${next}`}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                {hasUnreadAlertsForMyRole && (
                  <p style={{ fontSize: 12, color: "#f59e0b" }}>
                    Acknowledge all alerts above before changing order status.
                  </p>
                )}
                {!hasUnreadAlerts && (userRole !== "pack" && userRole !== "manager") && (
                  <p style={{ fontSize: 12, color: "#9ca3af" }}>Only Pack or Manager can change order status.</p>
                )}
                {!hasUnreadAlerts && (userRole === "pack" || userRole === "manager") && allowedNextStatuses.length === 0 && (
                  <p style={{ fontSize: 12, color: "#9ca3af" }}>
                    {orderStatus === "Special"
                      ? "This order is Special (ส่งเอง). Only account can manage payment status."
                      : orderStatus === "Pending"
                      ? "รอทางบัญชีตรวจสอบการชำระเงิน"
                      : "No further status steps for this order."}
                  </p>
                )}
              </div>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 5,
                maxWidth: "67%",
              }}
            >
              <div>
                <div style={label}>Sale ที่ขาย</div>
                <div style={value}>{saleName ?? "—"}</div>
              </div>
              {getFileByType(files, "shipping_address_image") && (
                <a
                  href={getFileByType(files, "shipping_address_image")!.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    ...linkBtn,
                    whiteSpace: "nowrap",
                    padding: "6px 10px",
                    fontSize: 12,
                  }}
                  title="เปิดไฟล์ที่อยู่จัดส่ง"
                >
                  📎 ที่อยู่จัดส่ง
                </a>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={label}>ชื่อลูกค้า</div>
                <div style={value}>{customerName || "—"} {customerPhone ? ` · ${customerPhone}` : ""}</div>
              </div>
              <div>
                <div style={label}>ที่อยู่จัดส่ง</div>
                <div style={{ ...value, whiteSpace: "pre-wrap" }}>{shippingAddress?.trim() || "—"}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={label}>วันที่จัดส่ง</div>
                <div style={value}>{shippingDate || "—"}</div>
              </div>
              <div>
                <div style={label}>Note การจัดส่ง</div>
                <div style={{ ...value, whiteSpace: "pre-wrap" }}>{shippingNote?.trim() || "—"}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={label}>รายการสินค้า</div>
                <div style={value}>{items.length ? items.map((i) => i.product_name).join(", ") : "—"}</div>
              </div>
              <div>
                <div style={label}>ยอดชำระทั้งหมด</div>
                <div style={value}>฿{netTotal.toLocaleString()}</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={label}>ของแถม</div>
                <div style={value}>{orderFreebies.length ? orderFreebies.map((f) => f.freebie_name ?? `Freebie #${f.id}`).join(", ") : "—"}</div>
              </div>
              <div>
                <div style={label}>Note ของแถม</div>
                <div style={{ ...value, whiteSpace: "pre-wrap" }}>{freebieNote?.trim() || "—"}</div>
              </div>
            </div>
            <div style={label}>Tracking number</div>
            <div style={value}>{trackingNumber?.trim() || "—"}</div>
            {getFilesByType(files, "invoice_submit").length > 0 && (
              <>
                <div style={label}>Invoice (submitted)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                  {getFilesByType(files, "invoice_submit").map((f, i) => (
                    <a
                      key={f.id ?? i}
                      href={f.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "#3b82f6",
                        fontSize: 14,
                        textDecoration: "none",
                      }}
                    >
                      📄 View invoice file {getFilesByType(files, "invoice_submit").length > 1 ? `#${i + 1}` : ""}
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab: Customer (Section 2) */}
        {activeTab === "customer" && (
          <>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={sectionTitle}>Customer & Shipping</div>
          {canEditShippingAndCustomer ? (
            <span style={editableBadge}>✏️ Editable</span>
          ) : (
            <span style={readOnlyBadge}>🔒 Read-only</span>
          )}
        </div>
        {!canEditShippingAndCustomer && (
          <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>
            Customer and shipping can only be edited when order status is Pending or Checked.
          </p>
        )}
        <div style={{ marginBottom: 16 }}>
          <div style={label}>Shipping date</div>
          {canEditShippingAndCustomer ? (
            <>
              <input
                type="date"
                value={shippingDate}
                onChange={(e) => setShippingDate(e.target.value)}
                style={{
                  ...inputStyle,
                  maxWidth: 200,
                  borderColor: "rgba(34, 197, 94, 0.35)",
                }}
              />
              <button
                type="button"
                onClick={handleSaveShippingDate}
                disabled={savingShippingDate}
                style={{ ...saveBtn, marginLeft: 8 }}
              >
                {savingShippingDate ? "Saving…" : "Save date"}
              </button>
            </>
          ) : (
            <div style={value}>{shippingDate ? shippingDate : "—"}</div>
          )}
        </div>
        <div style={canEditShippingAndCustomer ? editableBlockWrap : readOnlyBlockWrap}>
          <div style={label}>Customer Name</div>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            style={{
              ...inputStyle,
              opacity: canEditShippingAndCustomer ? 1 : 0.85,
              borderColor: canEditShippingAndCustomer ? "rgba(34, 197, 94, 0.35)" : "#555",
            }}
            placeholder="Customer name"
            disabled={!canEditShippingAndCustomer}
            readOnly={!canEditShippingAndCustomer}
          />
          <div style={label}>Phone Number</div>
          <input
            type="text"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            style={{
              ...inputStyle,
              opacity: canEditShippingAndCustomer ? 1 : 0.85,
              borderColor: canEditShippingAndCustomer ? "rgba(34, 197, 94, 0.35)" : "#555",
            }}
            placeholder="Phone"
            disabled={!canEditShippingAndCustomer}
            readOnly={!canEditShippingAndCustomer}
          />
          <button
            type="button"
            onClick={handleSaveCustomer}
            disabled={savingCustomer || !canEditShippingAndCustomer}
            style={{ ...saveBtn, opacity: canEditShippingAndCustomer ? 1 : 0.6 }}
          >
            {savingCustomer ? "Saving…" : "Save Customer"}
          </button>

          <div style={{ ...label, marginTop: 16 }}>Shipping Address</div>
          <textarea
            value={shippingAddress}
            onChange={(e) => setShippingAddress(e.target.value)}
            style={{
              ...inputStyle,
              minHeight: 80,
              opacity: canEditShippingAndCustomer ? 1 : 0.85,
              borderColor: canEditShippingAndCustomer ? "rgba(34, 197, 94, 0.35)" : "#555",
            }}
            placeholder="Shipping address"
            rows={3}
            disabled={!canEditShippingAndCustomer}
            readOnly={!canEditShippingAndCustomer}
          />
          {getFileByType(files, "shipping_address_image") && (
            <a
              href={getFileByType(files, "shipping_address_image")!.file_url}
              target="_blank"
              rel="noopener noreferrer"
              style={linkBtn}
            >
              📎 Shipping Address File
            </a>
          )}
          <div style={label}>Shipping Notes</div>
          <textarea
            value={shippingNote}
            onChange={(e) => setShippingNote(e.target.value)}
            style={{
              ...inputStyle,
              minHeight: 60,
              opacity: canEditShippingAndCustomer ? 1 : 0.85,
              borderColor: canEditShippingAndCustomer ? "rgba(34, 197, 94, 0.35)" : "#555",
            }}
            placeholder="Shipping notes"
            rows={2}
            disabled={!canEditShippingAndCustomer}
            readOnly={!canEditShippingAndCustomer}
          />
          <button
            type="button"
            onClick={handleSaveShipping}
            disabled={savingShipping || !canEditShippingAndCustomer}
            style={{ ...saveBtn, opacity: canEditShippingAndCustomer ? 1 : 0.6 }}
          >
            {savingShipping ? "Saving…" : "Save Shipping"}
          </button>
        </div>
          </>
        )}

        {/* Tab: Order details (Section 3) */}
        {activeTab === "order" && (
          <>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={sectionTitle}>Order Details</div>
          <span style={productEditable ? editableBadge : readOnlyBadge}>
            {productEditable ? "✏️ Editable" : "🔒 Read-only"}
          </span>
        </div>
        {!productEditable && (
          <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>
            Main product can be edited only when order is Pending, or when status is Checked/Packing and the net total is unchanged. After Shipped, editing is not allowed.
          </p>
        )}
        <div style={productEditable ? editableBlockWrap : readOnlyBlockWrap}>
          <div style={label}>Main Product(s)</div>
          <div style={value}>
            {items.length === 0
              ? "—"
              : items.map((item) => {
                  const currentProductId = item.product_id ?? 0;
                  const hasCurrent = products.some((p) => p.id === currentProductId);
                  const options =
                    hasCurrent
                      ? products
                      : [{ id: currentProductId, name: item.product_name, price: Number(item.unit_price) }, ...products];
                  if (productEditable && options.length > 0) {
                    return (
                      <div key={item.id} style={{ marginBottom: 12 }}>
                        <select
                          value={currentProductId || ""}
                          onChange={(e) => handleChangeMainProduct(item.id, Number(e.target.value), currentProductId)}
                          disabled={savingItemId === item.id}
                          style={{
                            ...inputStyle,
                            maxWidth: "100%",
                            borderColor: "rgba(34, 197, 94, 0.35)",
                          }}
                        >
                          <option value="">-- เลือกสินค้า --</option>
                          {options.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — ฿{Number(p.price).toLocaleString()}
                            </option>
                          ))}
                        </select>
                        {savingItemId === item.id && (
                          <span style={{ marginLeft: 8, fontSize: 12, color: "#22c55e" }}>Updating…</span>
                        )}
                      </div>
                    );
                  }
                  return (
                    <div key={item.id} style={{ marginBottom: 4 }}>
                      {item.product_name} — ฿{Number(item.unit_price) - Number(item.discount)}
                    </div>
                  );
                })}
          </div>
        </div>
        <div style={label}>Discount %</div>
        <div style={value}>
          {items.length === 0
            ? "—"
            : items.map((item) => {
                const unitPrice = Number(item.unit_price);
                const currentDiscount = Number(item.discount);
                const currentOption = discountOptionFromAmount(unitPrice, currentDiscount);
                if (canEditDiscount) {
                  return (
                    <div key={item.id} style={{ marginBottom: 12 }}>
                      <span style={{ marginRight: 8 }}>{item.product_name}:</span>
                      <select
                        value={currentOption}
                        onChange={(e) => {
                          const opt = e.target.value;
                          const newAmount = discountAmountFromOption(unitPrice, opt);
                          handleChangeDiscount(item.id, newAmount, currentDiscount);
                        }}
                        disabled={savingDiscountItemId === item.id}
                        style={{
                          ...inputStyle,
                          display: "inline-block",
                          width: "auto",
                          minWidth: 140,
                          borderColor: "rgba(34, 197, 94, 0.35)",
                        }}
                      >
                        <option value="">-- ส่วนลด --</option>
                        <option value="5">5%</option>
                        <option value="10">10%</option>
                        <option value="15">15%</option>
                        <option value="20">20%</option>
                        <option value="1000">1000 บาท</option>
                      </select>
                      {savingDiscountItemId === item.id && (
                        <span style={{ marginLeft: 8, fontSize: 12, color: "#22c55e" }}>Updating…</span>
                      )}
                    </div>
                  );
                }
                const label =
                  currentOption === ""
                    ? (currentDiscount >= 0.01 ? `฿${currentDiscount.toLocaleString()}` : "—")
                    : currentOption === "1000"
                      ? "1000 บาท"
                      : `${currentOption}%`;
                return (
                  <div key={item.id} style={{ marginBottom: 4 }}>
                    {item.product_name}: {label}
                  </div>
                );
              })}
        </div>
        <div style={label}>Free Gift Items</div>
        <div style={value}>
          {(() => {
            const fromOrder = orderFreebies.map((f) => (
              <div key={`of-${f.id}`}>🎁 {f.freebie_name ?? `Freebie #${f.id}`}</div>
            ));
            const fromItems = items.flatMap((item) => (item.freebies ?? []).map((f) => (
              <div key={`item-${f.id}`}>🎁 {(f as { freebie_name?: string | null }).freebie_name ?? `Freebie #${f.id}`}</div>
            )));
            const all = [...fromOrder, ...fromItems];
            if (all.length === 0) return "—";
            return all;
          })()}
        </div>
        <div style={label}>Freebie note</div>
        {canEditFreebieNote ? (
          <>
            <textarea
              value={freebieNote}
              onChange={(e) => setFreebieNote(e.target.value)}
              placeholder="e.g. ที่นวดคอ"
              rows={3}
              style={{
                ...inputStyle,
                borderColor: "rgba(34, 197, 94, 0.35)",
                minHeight: 60,
              }}
            />
            <button
              type="button"
              onClick={handleSaveFreebieNote}
              disabled={savingFreebieNote}
              style={saveBtn}
            >
              {savingFreebieNote ? "Saving…" : "Save Freebie note"}
            </button>
          </>
        ) : (
          <div style={{ ...value, whiteSpace: "pre-wrap" }}>
            {freebieNote.trim() ? freebieNote : "—"}
          </div>
        )}
        <div style={label}>Total Amount Payable</div>
        <div style={value}>฿{netTotal.toLocaleString()}</div>
          </>
        )}

        {/* Tab: Payment (Section 4 + payment method & status) */}
        {activeTab === "payment" && (
          <>
        <div style={sectionTitle}>Payment & Invoice</div>
        <div style={label}>ช่องทางการชำระเงิน</div>
        {canEditPaymentMethod ? (
          <>
            <select
              value={paymentMethod}
              onChange={(e) => {
                setPaymentMethod(e.target.value);
                if (e.target.value !== "card_2c2p" && e.target.value !== "card_pay") {
                  setInstallmentType("");
                  setInstallmentMonths("");
                }
              }}
              style={{
                ...inputStyle,
                maxWidth: "100%",
                borderColor: "rgba(34, 197, 94, 0.35)",
              }}
            >
              <option value="">-- เลือก --</option>
              <option value="cod">⭐ปลายทาง</option>
              <option value="transfer">💎โอน</option>
              <option value="card_2c2p">💳บัตร 2C2P</option>
              <option value="card_pay">💳บัตร PAY</option>
              <option value="special">🚗 Special (พี่วัฒน์)</option>
            </select>
            {(paymentMethod === "card_2c2p" || paymentMethod === "card_pay") && (
              <>
                <div style={{ ...label, marginTop: 12 }}>ประเภทการชำระ</div>
                <select
                  value={installmentType}
                  onChange={(e) => {
                    setInstallmentType(e.target.value);
                    if (e.target.value !== "installment") setInstallmentMonths("");
                  }}
                  style={{
                    ...inputStyle,
                    maxWidth: "100%",
                    borderColor: "rgba(34, 197, 94, 0.35)",
                  }}
                >
                  <option value="">-- เลือก --</option>
                  <option value="full">ตัดเต็ม</option>
                  <option value="installment">ผ่อน</option>
                </select>
                {installmentType === "installment" && (
                  <>
                    <div style={label}>จำนวนเดือน</div>
                    <select
                      value={installmentMonths}
                      onChange={(e) => setInstallmentMonths(e.target.value)}
                      style={{
                        ...inputStyle,
                        maxWidth: "100%",
                        borderColor: "rgba(34, 197, 94, 0.35)",
                      }}
                    >
                      <option value="">-- เลือก --</option>
                      <option value="6">6 เดือน</option>
                      <option value="10">10 เดือน</option>
                    </select>
                  </>
                )}
              </>
            )}
            <button type="button" onClick={handleSavePaymentMethod} disabled={savingPaymentMethod} style={saveBtn}>
              {savingPaymentMethod ? "Saving…" : "Save Payment Method"}
            </button>
          </>
        ) : (
          <div style={value}>
            {paymentMethod === "cod" && "⭐ปลายทาง"}
            {paymentMethod === "transfer" && "💎โอน"}
            {paymentMethod === "card_2c2p" && "💳บัตร 2C2P"}
            {paymentMethod === "card_pay" && "💳บัตร PAY"}
            {paymentMethod === "special" && "🚗 Special (ส่งเอง)"}
            {!["cod", "transfer", "card_2c2p", "card_pay", "special"].includes(paymentMethod) && (paymentMethod || "—")}
            {(paymentMethod === "card_2c2p" || paymentMethod === "card_pay") && (installmentType === "full" ? " (ตัดเต็ม)" : installmentType === "installment" ? ` (ผ่อน ${installmentMonths || "?"} เดือน)` : "")}
          </div>
        )}
        <div style={{ marginTop: 12, marginBottom: 4 }}>
          <div style={label}>จำนวนเงินที่ต้องชำระ</div>
          <div style={value}>฿{netTotal.toLocaleString()}</div>
        </div>
        {getFileByType(files, "chat_evidence") && (
          <a
            href={getFileByType(files, "chat_evidence")!.file_url}
            target="_blank"
            rel="noopener noreferrer"
            style={linkBtn}
          >
            💬 Chat Conversation Proof
          </a>
        )}
        {getFileByType(files, "payment_slip") && (
          <a
            href={getFileByType(files, "payment_slip")!.file_url}
            target="_blank"
            rel="noopener noreferrer"
            style={linkBtn}
          >
            💳 Payment Slip Proof
          </a>
        )}
        <div style={{ marginTop: 16 }}>
          <div style={label}>Payment Status (เฉพาะฝ่ายบัญชี)</div>
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            style={{
              padding: "8px 12px",
              marginRight: 8,
              marginBottom: 8,
              background: "#333",
              border: "1px solid #555",
              borderRadius: 8,
              color: "#eee",
              fontSize: 14,
            }}
          >
            <option value="Unchecked">Unchecked</option>
            <option value="Checked">Checked</option>
            <option value="Paid">Paid</option>
            <option value="Received">Received</option>
            <option value="Unmatched">Unmatched</option>
          </select>
          {paymentStatus === "Paid" && (
            <>
              <input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                style={{
                  padding: "8px 12px",
                  marginRight: 8,
                  marginBottom: 8,
                  background: "#333",
                  border: "1px solid #555",
                  borderRadius: 8,
                  color: "#eee",
                }}
              />
              <input
                type="text"
                placeholder="Paid note"
                value={paidNote}
                onChange={(e) => setPaidNote(e.target.value)}
                style={{
                  padding: "8px 12px",
                  marginRight: 8,
                  marginBottom: 8,
                  width: 180,
                  background: "#333",
                  border: "1px solid #555",
                  borderRadius: 8,
                  color: "#eee",
                }}
              />
            </>
          )}
          <button
            type="button"
            onClick={handleSavePaymentStatus}
            disabled={savingPayment}
            style={{
              padding: "8px 16px",
              background: "#2563eb",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              cursor: savingPayment ? "not-allowed" : "pointer",
              fontSize: 14,
            }}
          >
            {savingPayment ? "Saving…" : "Save Payment Status"}
          </button>
        </div>

        <div style={{ ...sectionTitle, marginTop: 24 }}>Invoice request</div>
        <div style={label}>📄 ต้องการใบกำกับภาษี?</div>
        <select
          value={invoiceRequired ? "yes" : "no"}
          onChange={(e) => {
            const need = e.target.value === "yes";
            setInvoiceRequired(need);
            if (!need) setInvoiceText("");
          }}
          style={{
            ...inputStyle,
            maxWidth: 280,
            borderColor: "rgba(34, 197, 94, 0.35)",
          }}
        >
          <option value="no">ไม่ต้องการ</option>
          <option value="yes">ต้องการ</option>
        </select>
        {invoiceRequired && (
          <>
            <div style={{ ...label, marginTop: 10 }}>รายละเอียดใบกำกับภาษี</div>
            <textarea
              value={invoiceText}
              onChange={(e) => setInvoiceText(e.target.value)}
              placeholder="กรอกข้อมูลใบกำกับภาษี"
              rows={3}
              style={{
                ...inputStyle,
                borderColor: "rgba(34, 197, 94, 0.35)",
                minHeight: 60,
              }}
            />
            {getFileByType(files, "invoice") && (
              <a
                href={getFileByType(files, "invoice")!.file_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...linkBtn,
                  marginTop: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                📎 ไฟล์ใบกำกับภาษี
              </a>
            )}
          </>
        )}
        <button
          type="button"
          onClick={handleSaveInvoice}
          disabled={savingInvoice}
          style={{ ...saveBtn, marginTop: 10 }}
        >
          {savingInvoice ? "Saving…" : "Save Invoice"}
        </button>
          </>
        )}

        {/* Tab: Manager (manager only — no restrictions on order status / payment status) */}
        {activeTab === "manager" && isManager && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>
              As manager you can change order status and payment status without restrictions (e.g. even with unread alerts).
            </p>
            <div style={sectionTitle}>Order status</div>
            <div style={label}>Current status</div>
            <div style={{ ...value, marginBottom: 8 }}>{orderStatus === "Special" ? "🚗 Special" : (orderStatus || "—")}</div>
            {allowedNextStatuses.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 24 }}>
                {allowedNextStatuses.map((next: string) => (
                  <button
                    key={next}
                    type="button"
                    onClick={() => handleChangeOrderStatus(next)}
                    disabled={savingOrderStatus}
                    style={{
                      ...saveBtn,
                      background: next === "Fail" ? "#b91c1c" : "#2563eb",
                    }}
                  >
                    {savingOrderStatus ? "Updating…" : `→ ${next}`}
                  </button>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 24 }}>
                {orderStatus === "Pending"
                  ? "Order becomes Checked when payment status is set to Checked. After that you can change to Packing, Shipped, etc."
                  : "No further status steps for this order."}
              </p>
            )}
            <div style={sectionTitle}>Payment status</div>
            <div style={label}>Status</div>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              style={{
                padding: "8px 12px",
                marginRight: 8,
                marginBottom: 8,
                background: "#333",
                border: "1px solid #555",
                borderRadius: 8,
                color: "#eee",
                fontSize: 14,
              }}
            >
              <option value="Unchecked">Unchecked</option>
              <option value="Checked">Checked</option>
              <option value="Paid">Paid</option>
              <option value="Received">Received</option>
              <option value="Unmatched">Unmatched</option>
            </select>
            {paymentStatus === "Paid" && (
              <>
                <input
                  type="date"
                  value={paidDate}
                  onChange={(e) => setPaidDate(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    marginRight: 8,
                    marginBottom: 8,
                    background: "#333",
                    border: "1px solid #555",
                    borderRadius: 8,
                    color: "#eee",
                  }}
                />
                <input
                  type="text"
                  placeholder="Paid note"
                  value={paidNote}
                  onChange={(e) => setPaidNote(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    marginRight: 8,
                    marginBottom: 8,
                    width: 180,
                    background: "#333",
                    border: "1px solid #555",
                    borderRadius: 8,
                    color: "#eee",
                  }}
                />
              </>
            )}
            <button
              type="button"
              onClick={handleSavePaymentStatus}
              disabled={savingPayment}
              style={{ ...saveBtn, marginLeft: 8 }}
            >
              {savingPayment ? "Saving…" : "Save Payment Status"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
