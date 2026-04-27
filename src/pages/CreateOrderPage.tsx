import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import api from "../services/api";

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

type ProductFreebie = {
  id: number;
  name: string;
};

type Product = {
  id: number;
  name: string;
  price: number;
};

/** Stored as rule; baht amount is always derived from current product price (fixes wrong net after changing product). */
type DiscountRule = "" | "5" | "8" | "10" | "15" | "20" | "1000" | "1500";

type OrderItemForm = {
  product_id: number;
  discount_rule: DiscountRule;
  freebies: number[];
};

function discountBahtFromRule(
  product: Product | undefined,
  rule: DiscountRule
): number {
  if (!product || !rule) return 0;
  const price = Number(product.price) || 0;
  switch (rule) {
    case "5":
      return price * 0.05;
    case "8":
      return price * 0.08;
    case "10":
      return price * 0.1;
    case "15":
      return price * 0.15;
    case "20":
      return price * 0.2;
    case "1000":
      return 1000;
    case "1500":
      return 1500;
    default:
      return 0;
  }
}

const CARD_PAYMENT_METHODS = ["card_2c2p", "card_pay", "deposit_card_2c2p", "deposit_card_pay"] as const;
const DEPOSIT_PAYMENT_METHODS = ["deposit_cod", "deposit_transfer", "deposit_card_2c2p", "deposit_card_pay"] as const;

export default function CreateOrderPage() {
  const navigate = useNavigate();
  const role = getUserRole();
  if (role !== "sale" && role !== "manager") return <Navigate to="/menu" replace />;

  const token = localStorage.getItem("token");
  const payload = token ? JSON.parse(atob(token.split(".")[1])) : null;
  const saleId = payload?.user_id ?? "-";

  const [shippingDate, setShippingDate] = useState("");
  const [addressText, setAddressText] = useState("");
  const [shippingImage, setShippingImage] = useState<File | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [needInvoice, setNeedInvoice] = useState(false);
  const [invoiceText, setInvoiceText] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  const [pageName, setPageName] = useState("");
  const [pageNameOptions, setPageNameOptions] = useState<string[]>([]);
  const [pageNameMode, setPageNameMode] = useState<"list" | "custom">("list");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  // Shipping method is always Normal now; no selection UI.
  const [installmentType, setInstallmentType] = useState("");
  const [installmentMonths, setInstallmentMonths] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  

  const [chatFile, setChatFile] = useState<File | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<OrderItemForm[]>([]);
  const [note, setNote] = useState("");
  const [shippingNote, setShippingNote] = useState("");
  const [freebies, setFreebies] = useState<ProductFreebie[]>([]);
  const [selectedFreebies, setSelectedFreebies] = useState<number[]>([]);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "100%",
    padding: "12px 14px",
    marginTop: 6,
    marginBottom: 6,
    borderRadius: 10,
    border: "1px solid #3a3a4a",
    fontSize: "clamp(14px, 4vw, 16px)",
    background: "#252530",
    color: "#eee",
    boxSizing: "border-box",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
  };

  const primaryButton: React.CSSProperties = {
    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
    color: "white",
    padding: "12px 20px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 15,
    minHeight: 44,
  };

  const secondaryButton: React.CSSProperties = {
    background: "#dc2626",
    color: "white",
    padding: "10px 16px",
    borderRadius: 10,
    border: "none",
    marginTop: 10,
    cursor: "pointer",
    fontSize: 14,
    minHeight: 40,
  };

  const cardSection: React.CSSProperties = {
    background: "rgba(38, 38, 48, 0.6)",
    padding: "clamp(16px, 4vw, 24px)",
    borderRadius: 14,
    marginBottom: 24,
    border: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
    minWidth: 0,
  };

  const productCard: React.CSSProperties = {
    border: "1px solid #3a3a4a",
    padding: "clamp(12px, 3vw, 18px)",
    borderRadius: 12,
    marginBottom: 14,
    background: "rgba(45, 45, 55, 0.8)",
    minWidth: 0,
  };

  const checkboxStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 10,
    cursor: "pointer",
    color: "#ddd",
    fontSize: 14,
  };

  useEffect(() => {
    api.get("/products").then((res) => {
      setProducts(res.data);
    });

    api.get("/products/freebies").then((res) => {
      setFreebies(res.data);
    });

    // Load page names from backend
    api
      .get<Array<{ id: number; name: string }>>("/orders/page-names")
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        const names = Array.from(new Set(list.map((p) => (p.name ?? "").trim()).filter(Boolean)));
        setPageNameOptions(names);
      })
      .catch(() => {
        setPageNameOptions([]);
      });
  }, []);

  const extractNamePhone = () => {
    const lines = addressText.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      setCustomerName(lines[0]);
      setCustomerPhone(lines[lines.length - 1]);
    }
  };

  const addItem = () => {
    setItems([...items, { product_id: 0, discount_rule: "", freebies: [] }]);
  };

  const removeItem = (index: number) => {
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
  };


  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const hasValidItem = items.some((i) => i.product_id !== 0);
  const hasIncompleteItem = items.some((i) => i.product_id === 0);

  const orderNetTotal = useMemo(() => {
    return items
      .filter((i) => i.product_id !== 0)
      .reduce((sum, item) => {
        const p = products.find((x) => x.id === item.product_id);
        const price = p?.price ?? 0;
        const disc = discountBahtFromRule(p, item.discount_rule);
        return sum + (price - disc);
      }, 0);
  }, [items, products]);

  const depositAmountNum = parseFloat(String(depositAmount).replace(/,/g, "").trim());
  const depositAmountValid =
    !DEPOSIT_PAYMENT_METHODS.includes(paymentMethod as (typeof DEPOSIT_PAYMENT_METHODS)[number]) ||
    (!Number.isNaN(depositAmountNum) &&
      depositAmountNum > 0 &&
      (orderNetTotal <= 0 || depositAmountNum <= orderNetTotal + 1e-6));

  const isSubmitDisabled =
    !chatFile ||
    !slipFile ||
    !hasValidItem ||
    hasIncompleteItem ||
    !pageName.trim() ||
    !paymentMethod ||
    (DEPOSIT_PAYMENT_METHODS.includes(paymentMethod as (typeof DEPOSIT_PAYMENT_METHODS)[number]) && !depositAmountValid);

  const handleSubmit = async () => {
    let orderId: number | undefined;

    try {

      if (!chatFile || !slipFile) {
        alert("กรุณาอัปโหลดหลักฐานแชทและสลิปก่อน");
        return;
      }

      if (!pageName || !paymentMethod) {
        alert("ข้อมูลไม่ครบ");
        return;
      }

      if (DEPOSIT_PAYMENT_METHODS.includes(paymentMethod as (typeof DEPOSIT_PAYMENT_METHODS)[number])) {
        const dn = parseFloat(String(depositAmount).replace(/,/g, "").trim());
        if (Number.isNaN(dn) || dn <= 0) {
          alert("กรุณากรอกยอดมัดจำ (มากกว่า 0)");
          return;
        }
        const net = items
          .filter((i) => i.product_id !== 0)
          .reduce((sum, item) => {
            const p = products.find((x) => x.id === item.product_id);
            const price = p?.price ?? 0;
            const disc = discountBahtFromRule(p, item.discount_rule);
            return sum + (price - disc);
          }, 0);
        if (net > 0 && dn > net + 1e-6) {
          alert("ยอดมัดจำต้องไม่เกินยอดรวมออเดอร์");
          return;
        }
      }

      const paymentMethodLabelMap: Record<string, string> = {
        cod: "ปลายทาง (COD)",
        deposit_cod: "มัดจำ + ปลายทาง (Deposit + COD)",
        deposit_transfer: "มัดจำ + โอน",
        deposit_card_2c2p: "มัดจำ + บัตร 2C2P",
        deposit_card_pay: "มัดจำ + บัตร PAY",
        transfer: "โอน",
        card_2c2p: "บัตร 2C2P",
        card_pay: "บัตร PAY",
      };
      const selectedItems = items.filter((item) => item.product_id !== 0);
      const productSummary = selectedItems.length
        ? selectedItems
            .map((item) => products.find((p) => p.id === item.product_id)?.name ?? `#${item.product_id}`)
            .join(", ")
        : "-";
      const freebieSummary = selectedFreebies.length
        ? selectedFreebies
            .map((id) => freebies.find((f) => f.id === id)?.name ?? `#${id}`)
            .join(", ")
        : "-";
      const discountRuleLabel: Record<string, string> = {
        "5": "5%",
        "8": "8%",
        "10": "10%",
        "15": "15%",
        "20": "20%",
        "1000": "1000 บาท",
        "1500": "1500 บาท",
      };
      const discountSummary = selectedItems.length
        ? selectedItems
            .map((item) => {
              if (!item.discount_rule) return "0";
              return discountRuleLabel[item.discount_rule] ?? item.discount_rule;
            })
            .join(", ")
        : "-";
      const installmentSummary =
        CARD_PAYMENT_METHODS.includes(paymentMethod as (typeof CARD_PAYMENT_METHODS)[number]) && installmentType === "installment" && installmentMonths
          ? ` (${installmentMonths} เดือน)`
          : "";

      const depositSummary =
        DEPOSIT_PAYMENT_METHODS.includes(paymentMethod as (typeof DEPOSIT_PAYMENT_METHODS)[number])
          ? (() => {
              const dn = parseFloat(String(depositAmount).replace(/,/g, "").trim());
              const net = items
                .filter((i) => i.product_id !== 0)
                .reduce((sum, item) => {
                  const p = products.find((x) => x.id === item.product_id);
                  const price = p?.price ?? 0;
                  const disc = discountBahtFromRule(p, item.discount_rule);
                  return sum + (price - disc);
                }, 0);
              const remain = Math.max(0, net - (Number.isNaN(dn) ? 0 : dn));
              const remainLabel =
                paymentMethod === "deposit_cod"
                  ? "เก็บปลายทาง"
                  : paymentMethod === "deposit_transfer"
                    ? "ยอดโอนคงเหลือ"
                    : "ยอดบัตรคงเหลือ";
              return `\nมัดจำ: ฿${Number.isNaN(dn) ? "?" : dn.toLocaleString("th-TH")} / ${remainLabel}: ฿${remain.toLocaleString("th-TH")}`;
            })()
          : "";

      const summaryText = [
        "สรุปการสร้างออเดอร์",
        `ชื่อลูกค้า: ${customerName || "-"}`,
        `จากเพจ: ${pageName || "-"}`,
        `สินค้า: ${productSummary}`,
        `ของแถม: ${freebieSummary}${note.trim() ? ` + ${note.trim()}` : ""}`,
        `ส่วนลด: ${discountSummary}`,
        `ช่องทางการชำระเงิน: ${(paymentMethodLabelMap[paymentMethod] ?? paymentMethod ?? "-")}${installmentSummary}${depositSummary}`,
        `วันจัดส่ง: ${shippingDate || "-"}`,
        "",
        "ยืนยันการสร้างออเดอร์?",
      ].join("\n");

      if (!window.confirm(summaryText)) return;

      setIsUploading(true);
      setUploadProgress(0);

      const depositForApi =
        DEPOSIT_PAYMENT_METHODS.includes(paymentMethod as (typeof DEPOSIT_PAYMENT_METHODS)[number])
          ? parseFloat(String(depositAmount).replace(/,/g, "").trim())
          : null;

      const orderRes = await api.post("/orders", {
        customer_name: customerName,
        customer_phone: customerPhone,
        shipping_address: addressText,
        shipping_date: shippingDate || null,
        payment_method: paymentMethod || null,
        deposit_amount: depositForApi != null && !Number.isNaN(depositForApi) ? depositForApi : null,
        shipping_method: "Normal",
        invoice_text: invoiceText || null,
        note: note || null,
        shipping_note: shippingNote || null,
        pageName: pageName || null,
        installment_type: installmentType || null,
        installment_months: installmentMonths || null,
      });

      orderId = orderRes.data.order_id;

      for (const freebieId of selectedFreebies) {
        await api.post(`/orders/${orderId}/freebies`, null, {
          params: { freebie_id: freebieId }
        });
      }

      const validItems = items.filter((item) => item.product_id !== 0);
      for (const item of validItems) {
        const p = products.find((x) => x.id === item.product_id);
        const discountBaht = discountBahtFromRule(p, item.discount_rule);
        await api.post(`/orders/${orderId}/items`, null, {
          params: {
            product_id: item.product_id,
            discount: discountBaht,
          },
        });
      }



      await api.put(`/orders/${orderId}/payment-method`, null, {
        params: {
          payment_method: paymentMethod,
          installment_type: CARD_PAYMENT_METHODS.includes(paymentMethod as (typeof CARD_PAYMENT_METHODS)[number]) ? (installmentType || null) : null,
          installment_months: CARD_PAYMENT_METHODS.includes(paymentMethod as (typeof CARD_PAYMENT_METHODS)[number]) && installmentType === "installment" && installmentMonths
            ? Number(installmentMonths)
            : null,
          deposit_amount:
            DEPOSIT_PAYMENT_METHODS.includes(paymentMethod as (typeof DEPOSIT_PAYMENT_METHODS)[number]) && depositForApi != null && !Number.isNaN(depositForApi)
              ? depositForApi
              : null,
        },
      });

      const uploadFile = async (file: File, type: string) => {
        const form = new FormData();
        form.append("file_type", type);
        form.append("file", file);

        await api.post(`/orders/${orderId}/upload-file`, form, {
          onUploadProgress: (progressEvent) => {
            if (!progressEvent.total) return;

            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );

            setUploadProgress(percent);
          }
        });
      };

      if (chatFile) await uploadFile(chatFile, "chat_evidence");
      if (slipFile) await uploadFile(slipFile, "payment_slip");
      if (shippingImage) await uploadFile(shippingImage, "shipping_address_image");
      if (needInvoice && invoiceFile) {
        await uploadFile(invoiceFile, "invoice");
      }

      // Notify LINE after everything succeeded (order, items, payment, files).
      try {
        await api.post(`/orders/${orderId}/notify-created`);
      } catch {
        // ถ้าแจ้งเตือนไม่สำเร็จ ไม่ต้อง block การสร้างออเดอร์
      }

      alert("สร้างออเดอร์สำเร็จ");
      setIsUploading(false);
      navigate("/orders");

    } catch (err) {
      console.error(err);
      setIsUploading(false);
      if (orderId != null) {
        try {
          await api.delete(`/orders/${orderId}/abandon-create`);
          alert(
            "อัปโหลดไฟล์ไม่สำเร็จ ระบบได้ยกเลิกออเดอร์นี้แล้ว กรุณาลองสร้างออเดอร์ใหม่อีกครั้ง"
          );
        } catch (rollbackErr) {
          console.error(rollbackErr);
          alert(
            "อัปโหลดไฟล์ไม่สำเร็จ ออเดอร์อาจถูกสร้างแล้ว กรุณาตรวจสอบในรายการออเดอร์ หรือแจ้งผู้จัดการ"
          );
        }
      } else {
        alert("เกิดข้อผิดพลาด");
      }
    }
  };



  const pageWrap: React.CSSProperties = {
    minHeight: "100vh",
    background: "linear-gradient(160deg, #0f0f12 0%, #1a1a22 50%, #0f0f12 100%)",
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "clamp(12px, 4vw, 24px) clamp(12px, 4vw, 20px)",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    boxSizing: "border-box",
  };

  const cardWrap: React.CSSProperties = {
    width: "100%",
    maxWidth: 900,
    background: "rgba(28, 28, 36, 0.98)",
    padding: "clamp(20px, 5vw, 40px)",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
    boxSizing: "border-box",
  };

  const topBarStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  };

  const labelStyle: React.CSSProperties = { color: "#e0e0e0", fontWeight: 600, fontSize: "clamp(13px, 2.5vw, 14px)" };
  const hintStyle: React.CSSProperties = { color: "#f87171", fontWeight: 400, marginTop: 0 };
  const mutedStyle: React.CSSProperties = { color: "#888", fontSize: 13 };

  return (
    <div style={pageWrap}>
      <div style={cardWrap}>
        <div style={topBarStyle}>
          <div>
            <h1 style={{ color: "#f0f0f0", margin: 0, fontSize: "clamp(20px, 4vw, 24px)" }}>📜 Create Order</h1>
            <p style={{ color: "#9ca3af", margin: "4px 0 0", fontSize: 14 }}>
              Sale ID: <b style={{ color: "#c4b5fd" }}>{saleId}</b>
            </p>
          </div>
          <Link
            to="/orders"
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid #3a3a4a",
              background: "#252530",
              color: "#e0e0e0",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            ← Order List
          </Link>
        </div>

        {/* ================= Shipping ================= */}
        <div style={{ marginBottom: 0 }}>
          <label style={labelStyle}>🗓️ วันจัดส่ง <span style={hintStyle}>(*ถ้ารอตู้เข้าไม่ต้องเลือก)</span></label>

          <input
            type="date"
            value={shippingDate}
            onChange={(e) => setShippingDate(e.target.value)}
            style={inputStyle}
          />
        </div>
                  {/* หมายเหตุ 1 */}
          <div style={{ marginTop: 0 }}>
            <label style={labelStyle}>📝 หมายเหตุจัดส่ง</label>
            <textarea
              rows={3}
              value={shippingNote}
              onChange={(e) => setShippingNote(e.target.value)}
              placeholder="เช่น ลูกค้าสะดวกรับของช่วงวันเวลาไหน"
              style={inputStyle}
            />
          </div>

        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>📍 ที่อยู่จัดส่ง</label>
          <textarea
            rows={3}
            value={addressText}
            onChange={(e) => setAddressText(e.target.value)}
            placeholder="ชื่อลูกค้า / ที่อยู่ / เบอร์โทร (กรอกกี่บรรทัดก็ได้)"
            style={inputStyle}
          />
          <button style={secondaryButton} onClick={extractNamePhone}>
            ▷Extract ชื่อ / เบอร์
          </button>

          <div style={{ marginTop: 10, ...mutedStyle }}>
            <div>ชื่อ: {customerName || "-"}</div>
            <div>เบอร์: {customerPhone || "-"}</div>
          </div>
        </div>

        <div style={{ marginBottom: 30 }}>
          <label style={{ ...labelStyle, display: "block", marginBottom: 6 }}>🚚 Upload รูปที่อยู่ (ไม่บังคับ)</label>
          <input
            type="file"
            onChange={(e) =>
              setShippingImage(e.target.files?.[0] ?? null)
            }
            style={{ marginTop: 0, color: "#ccc", fontSize: 14 }}
          />
        </div>

        <div style={{ marginBottom: 30 }}>
          <label style={labelStyle}>💬 ชื่อเพจ</label>
          {pageNameOptions.length > 0 && pageNameMode === "list" ? (
            <>
              <select
                value={pageName}
                onChange={(e) => setPageName(e.target.value)}
                style={inputStyle}
              >
                <option value="">เลือกชื่อเพจ…</option>
                {pageNameOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setPageNameMode("custom");
                  setPageName("");
                }}
                style={{
                  marginTop: 6,
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid #555",
                  background: "#333",
                  color: "#eee",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                กรอกชื่อเพจเอง
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                value={pageName}
                onChange={(e) => setPageName(e.target.value)}
                placeholder="กรอกชื่อเพจที่ปิดการขาย"
                style={inputStyle}
              />
              {pageNameOptions.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setPageNameMode("list");
                    if (pageNameOptions.length > 0) {
                      setPageName(pageNameOptions[0]);
                    }
                  }}
                  style={{
                    marginTop: 6,
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #555",
                    background: "#333",
                    color: "#eee",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  เลือกจากรายการที่บันทึกไว้
                </button>
              )}
            </>
          )}
        </div>


        {/* ================= Invoice ================= */}
        <div style={cardSection}>
          <label style={labelStyle}>📄 ต้องการใบกำกับภาษี?</label>
          <select
            onChange={(e) => setNeedInvoice(e.target.value === "yes")}
            style={inputStyle}
          >
            <option value="no">ไม่ต้องการ</option>
            <option value="yes">ต้องการ</option>
          </select>

          {needInvoice && (
            <>
              <textarea
                rows={3}
                value={invoiceText}
                onChange={(e) => setInvoiceText(e.target.value)}
                placeholder="กรอกข้อมูลใบกำกับภาษี"
                style={inputStyle}
              />
              <label style={{ ...labelStyle, display: "block", marginTop: 12 }}>อัปโหลดรูป (ถ้ามี เช่น รูปที่อยู่/ข้อมูล)</label>
              <input
                type="file"
                onChange={(e) =>
                  setInvoiceFile(e.target.files?.[0] ?? null)
                }
                style={{ marginTop: 6, color: "#ccc", fontSize: 14 }}
              />
              <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>
                หมายเหตุ: ไฟล์นี้เป็นแค่รูป/ข้อมูลขอใบกำกับ ใบกำกับจริงจะอัปโหลดโดยบัญชี/ผู้จัดการในหน้า Invoice Submit
              </p>
            </>
          )}
        </div>

        {/* ================= Products ================= */}
        <div style={cardSection}>
          <h3 style={{ color: "#f0f0f0", marginBottom: 20, fontSize: 18 }}>📦 สินค้า</h3>

          {items.map((item, i) => (
              <div key={i} style={productCard}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                  fontWeight: 600
                }}>
                  <span style={{ color: "#e0e0e0" }}>สินค้า {i + 1}</span>

                  <button
                    onClick={() => removeItem(i)}
                    style={{
                      background: "#dc2626",
                      color: "white",
                      border: "none",
                      borderRadius: 6,
                      padding: "4px 10px",
                      cursor: "pointer"
                    }}
                  >
                    ลบ
                  </button>
                </div>

              <select
                value={item.product_id || ""}
                onChange={(e) => {
                  const pid = Number(e.target.value) || 0;
                  const next = [...items];
                  next[i] = {
                    ...next[i],
                    product_id: pid,
                    ...(pid === 0 ? { discount_rule: "" as DiscountRule } : {}),
                  };
                  setItems(next);
                }}
                style={inputStyle}
              >
                <option value="">-- เลือกสินค้า --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                value={item.discount_rule}
                onChange={(e) => {
                  const value = e.target.value as DiscountRule;
                  const product = products.find((p) => p.id === item.product_id);
                  if (!product && value !== "") return;
                  updateItem(i, "discount_rule", value);
                }}
                style={inputStyle}
              >
                <option value="">-- ส่วนลด --</option>
                <option value="5">5%</option>
                <option value="8">8%</option>
                <option value="10">10%</option>
                <option value="15">15%</option>
                <option value="20">20%</option>
                <option value="1000">1000 บาท</option>
                <option value="1500">1500 บาท</option>
              </select>
            </div>
          ))}

          <button style={primaryButton} onClick={addItem}>
            + เพิ่มสินค้า
          </button>
        </div>

        {/* ================= Freebies ================= */}
        <div style={cardSection}>
          <h3 style={{ color: "#f0f0f0", marginBottom: 20, fontSize: 18 }}>🎁 ของแถม</h3>

          {freebies.map((f) => (
            <label key={f.id} style={checkboxStyle}>
              <input
                type="checkbox"
                checked={selectedFreebies.includes(f.id)}

                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedFreebies([...selectedFreebies, f.id]);
                  } else {
                    setSelectedFreebies(
                      selectedFreebies.filter(id => id !== f.id)
                    );
                  }
                }}
                
              />
              <span style={{ color: "#e0e0e0" }}>{f.name}</span>
            </label>
          ))}

          {/* หมายเหตุ */}
          <div style={{ marginTop: 20 }}>
            <label style={labelStyle}>📝 ของแถมเพิ่ม</label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ที่นวดคอ"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ marginBottom: 30 }}>
          <label style={labelStyle}>🔴 ช่องทางการชำระเงิน</label>
          <select
            value={paymentMethod}
            onChange={(e) => {
              const v = e.target.value;
              setPaymentMethod(v);
              if (!DEPOSIT_PAYMENT_METHODS.includes(v as (typeof DEPOSIT_PAYMENT_METHODS)[number])) setDepositAmount("");
              if (!CARD_PAYMENT_METHODS.includes(v as (typeof CARD_PAYMENT_METHODS)[number])) {
                setInstallmentType("");
                setInstallmentMonths("");
              }
            }}
            style={inputStyle}
          >
            <option value="">-- เลือก --</option>
            <option value="cod">⭐ปลายทาง</option>
            <option value="deposit_cod">💵มัดจำ + ปลายทาง (Deposit + COD)</option>
            <option value="deposit_transfer">💵มัดจำ + 💎โอน</option>
            <option value="deposit_card_2c2p">💵มัดจำ + 💳บัตร 2C2P</option>
            <option value="deposit_card_pay">💵มัดจำ + 💳บัตร PAY</option>
            <option value="transfer">💎โอน</option>
            <option value="card_2c2p">💳บัตร 2C2P</option>
            <option value="card_pay">💳บัตร PAY</option>
          </select>

          {DEPOSIT_PAYMENT_METHODS.includes(paymentMethod as (typeof DEPOSIT_PAYMENT_METHODS)[number]) && (
            <>
              <label style={labelStyle}>ยอดมัดจำ (บาท)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="เช่น 5000"
                style={inputStyle}
              />
              {orderNetTotal > 0 && (
                <p style={{ margin: "8px 0 0", fontSize: 13, color: "#9ca3af" }}>
                  ยอดรวมออเดอร์ (ประมาณ): ฿{orderNetTotal.toLocaleString("th-TH")}
                  {" · "}
                  เก็บปลายทาง (ประมาณ): ฿
                  {Math.max(
                    0,
                    orderNetTotal -
                      (Number.isNaN(parseFloat(String(depositAmount).replace(/,/g, "")))
                        ? 0
                        : parseFloat(String(depositAmount).replace(/,/g, "")))
                  ).toLocaleString("th-TH")}
                </p>
              )}
            </>
          )}

          {CARD_PAYMENT_METHODS.includes(paymentMethod as (typeof CARD_PAYMENT_METHODS)[number]) && (
            <>
              <label style={labelStyle}>ประเภทการชำระ</label>
              <select
                value={installmentType}
                onChange={(e) => setInstallmentType(e.target.value)}
                style={inputStyle}
              >
                <option value="">-- เลือก --</option>
                <option value="full">ตัดเต็ม</option>
                <option value="installment">ผ่อน</option>
              </select>

              {installmentType === "installment" && (
                <>
                  <label style={labelStyle}>จำนวนเดือน</label>
                  <select
                    value={installmentMonths}
                    onChange={(e) => setInstallmentMonths(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">-- เลือก --</option>
                    <option value="6">6 เดือน</option>
                    <option value="10">10 เดือน</option>
                  </select>
                </>
              )}
            </>
          )}
        </div>

        {/* ================= Upload Required ================= */}
        <div style={cardSection}>
          <label style={{ ...labelStyle, marginTop: 20, display: "block" }}>
            📂 Upload Chat (จำเป็น)
          </label>
          <input
            type="file"
            onChange={(e) =>
              setChatFile(e.target.files?.[0] ?? null)
            }
            style={{ marginTop: 6, color: "#ccc", fontSize: 14 }}
          />

          <label style={{ ...labelStyle, marginTop: 20, display: "block" }}>
            📂 Upload Slip (จำเป็น)
          </label>
          <input
            type="file"
            onChange={(e) =>
              setSlipFile(e.target.files?.[0] ?? null)
            }
            style={{ marginTop: 6, color: "#ccc", fontSize: 14 }}
          />
        </div>

        {/* ================= Submit ================= */}
        {isUploading && (
          <div style={{ marginTop: 20 }}>
            <div style={{
              height: 10,
              background: "#2a2a3a",
              borderRadius: 10,
              overflow: "hidden",
            }}>
              <div style={{
                width: `${uploadProgress}%`,
                height: "100%",
                background: "linear-gradient(90deg, #2563eb, #3b82f6)",
                transition: "width 0.3s ease",
              }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 14, color: "#9ca3af" }}>
              กำลังอัปโหลด {uploadProgress}%
            </div>
          </div>
        )}

        {isSubmitDisabled && !isUploading && (
          <p style={{ marginTop: 20, fontSize: 13, color: "#9ca3af" }}>
            กรุณากรอกให้ครบ: ชื่อเพจ, ช่องทางชำระเงิน, เพิ่มสินค้าอย่างน้อย 1 รายการและเลือกสินค้าให้ครบทุกบรรทัด, อัปโหลด Chat และ Slip
          </p>
        )}
        <button
          onClick={handleSubmit}
          disabled={isSubmitDisabled || isUploading}
          style={{
            ...primaryButton,
            width: "100%",
            marginTop: 30,
            opacity: isSubmitDisabled || isUploading ? 0.5 : 1,
            cursor: isSubmitDisabled || isUploading ? "not-allowed" : "pointer",
          }}
        >
          {isUploading ? "กำลังอัปโหลด..." : "Submit Order"}
        </button>

      </div>
    </div>
  );
}
