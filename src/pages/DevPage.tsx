import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

type Freebie = {
  id: number;
  name: string;
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

const sectionStyle: React.CSSProperties = {
  marginBottom: 32,
  padding: 24,
  background: "#252525",
  border: "1px solid #444",
  borderRadius: 12,
  maxWidth: 480,
};
const labelStyle: React.CSSProperties = { display: "block", color: "#aaa", fontSize: 12, marginBottom: 6 };
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  marginBottom: 16,
  background: "#333",
  border: "1px solid #555",
  borderRadius: 8,
  color: "#eee",
  fontSize: 14,
  boxSizing: "border-box",
};
const buttonStyle: React.CSSProperties = {
  padding: "10px 20px",
  background: "#2563eb",
  border: "none",
  borderRadius: 8,
  color: "#fff",
  cursor: "pointer",
  fontSize: 14,
};

export default function DevPage() {
  const role = getUserRole();
  const isManager = role === "manager";

  const [categories, setCategories] = useState<string[]>([]);
  const [freebies, setFreebies] = useState<Freebie[]>([]);

  const [productCategory, setProductCategory] = useState("");
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productSubmitting, setProductSubmitting] = useState(false);
  const [productMessage, setProductMessage] = useState("");

  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("sale");
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [userMessage, setUserMessage] = useState("");

  const [orderIdsToDelete, setOrderIdsToDelete] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");

  const [pageNames, setPageNames] = useState<Array<{ id: number; name: string }>>([]);
  const [newPageName, setNewPageName] = useState("");
  const [pageNameMessage, setPageNameMessage] = useState("");

  const [newFreebieName, setNewFreebieName] = useState("");
  const [freebieSubmitting, setFreebieSubmitting] = useState(false);
  const [freebieMessage, setFreebieMessage] = useState("");

  useEffect(() => {
    if (!isManager) return;
    api.get<Array<{ category?: string | null }>>("/products").then((res) => {
      const list = Array.isArray(res.data) ? res.data : [];
      const cats = [...new Set(list.map((p) => p.category).filter(Boolean) as string[])].sort();
      setCategories(cats);
    }).catch(() => setCategories([]));
    api
      .get<Freebie[]>("/products/freebies")
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setFreebies(list.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => setFreebies([]));

    // Load page names from backend
    api
      .get<Array<{ id: number; name: string }>>("/orders/page-names")
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        const unique = list
          .map((p) => ({ id: p.id, name: (p.name ?? "").trim() }))
          .filter((p) => p.name.length > 0);
        // simple dedupe by name
        const seen = new Set<string>();
        const deduped: Array<{ id: number; name: string }> = [];
        for (const p of unique) {
          if (seen.has(p.name)) continue;
          seen.add(p.name);
          deduped.push(p);
        }
        setPageNames(deduped.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => setPageNames([]));
  }, [isManager]);

  const handleAddPageName = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPageName.trim();
    if (!name) {
      setPageNameMessage("กรอกชื่อเพจก่อน");
      return;
    }
    if (pageNames.some((p) => p.name === name)) {
      setPageNameMessage("มีชื่อนี้ในรายการแล้ว");
      return;
    }
    api
      .post("/orders/page-names", { name })
      .then(() => {
        setNewPageName("");
        setPageNameMessage("บันทึกชื่อเพจแล้ว");
        // reload list
        return api.get<Array<{ id: number; name: string }>>("/orders/page-names");
      })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setPageNames(list.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => {
        setPageNameMessage("บันทึกชื่อเพจไม่สำเร็จ");
      });
  };

  const handleRemovePageName = (name: string) => {
    const target = pageNames.find((p) => p.name === name);
    if (!target) return;
    api
      .delete(`/orders/page-names/${target.id}`)
      .then(() =>
        setPageNames((prev) => prev.filter((p) => p.id !== target.id))
      )
      .catch(() => {
        setPageNameMessage("ลบชื่อเพจไม่สำเร็จ");
      });
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productCategory.trim() || !productName.trim() || !productPrice.trim()) {
      setProductMessage("Fill category, name and price.");
      return;
    }
    const price = parseFloat(productPrice);
    if (Number.isNaN(price) || price < 0) {
      setProductMessage("Invalid price.");
      return;
    }
    setProductSubmitting(true);
    setProductMessage("");
    try {
      await api.post("/products", null, {
        params: { category: productCategory.trim(), name: productName.trim(), price },
      });
      setProductMessage("Product created.");
      setProductName("");
      setProductPrice("");
      setCategories((prev) => (prev.includes(productCategory.trim()) ? prev : [...prev, productCategory.trim()].sort()));
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err && typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === "string"
        ? (err as { response: { data: { detail: string } } }).response.data.detail
        : "Failed to create product.";
      setProductMessage(msg);
    } finally {
      setProductSubmitting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail.trim() || !userPassword) {
      setUserMessage("Fill email and password.");
      return;
    }
    setUserSubmitting(true);
    setUserMessage("");
    try {
      await api.post("/auth/register", {
        email: userEmail.trim(),
        password: userPassword,
        name: userName.trim() || userEmail.trim(),
        role: userRole,
      });
      setUserMessage("Account created.");
      setUserEmail("");
      setUserPassword("");
      setUserName("");
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err && typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === "string"
        ? (err as { response: { data: { detail: string } } }).response.data.detail
        : "Failed to create account.";
      setUserMessage(msg);
    } finally {
      setUserSubmitting(false);
    }
  };

  const handleCreateFreebie = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newFreebieName.trim();
    if (!name) {
      setFreebieMessage("Fill freebie name.");
      return;
    }
    if (freebies.some((f) => f.name.trim().toLowerCase() === name.toLowerCase())) {
      setFreebieMessage("Freebie already exists.");
      return;
    }
    setFreebieSubmitting(true);
    setFreebieMessage("");
    try {
      await api.post("/products/freebies", null, { params: { name } });
      setNewFreebieName("");
      setFreebieMessage("Freebie created.");
      const res = await api.get<Freebie[]>("/products/freebies");
      const list = Array.isArray(res.data) ? res.data : [];
      setFreebies(list.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err && typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === "string"
        ? (err as { response: { data: { detail: string } } }).response.data.detail
        : "Failed to create freebie.";
      setFreebieMessage(msg);
    } finally {
      setFreebieSubmitting(false);
    }
  };

  const handleDeleteOrders = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = orderIdsToDelete.trim().replace(/,/g, " ").split(/\s+/).filter(Boolean);
    if (raw.length === 0) {
      setDeleteMessage("Enter at least one order ID or order code (e.g. 123 or SG-26-03-08-00001).");
      return;
    }
    if (!window.confirm(`Delete ${raw.length} order(s) (${raw.join(", ")})? This cannot be undone.`)) return;
    setDeleteSubmitting(true);
    setDeleteMessage("");
    let ok = 0;
    let err: string[] = [];
    for (const token of raw) {
      try {
        await api.delete(`/orders/${encodeURIComponent(token)}`);
        ok += 1;
      } catch (res: unknown) {
        const ax = res && typeof res === "object" && "response" in res ? (res as { response?: { status?: number; data?: { detail?: string } } }).response : undefined;
        const detail = ax?.data?.detail ?? "Unknown error";
        err.push(`${token}: ${detail}`);
      }
    }
    setDeleteSubmitting(false);
    setOrderIdsToDelete("");
    if (err.length === 0) setDeleteMessage(`Deleted ${ok} order(s).`);
    else setDeleteMessage(`Deleted ${ok}; failed: ${err.join("; ")}`);
  };

  if (!isManager) {
    return (
      <div style={{ padding: 24, maxWidth: 600, margin: "0 auto", color: "#eee" }}>
        <p style={{ color: "#f59e0b" }}>Only Manager can access this page.</p>
        <Link to="/menu" style={{ color: "#60a5fa" }}>← Back to Menu</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 560, margin: "0 auto", color: "#eee" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Dev — Tools (Manager only)</h1>
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
          ← Menu
        </Link>
      </div>

      <form onSubmit={handleCreateProduct} style={sectionStyle}>
        <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Create Product</h2>
        <label style={labelStyle}>Category</label>
        <input
          type="text"
          value={productCategory}
          onChange={(e) => setProductCategory(e.target.value)}
          placeholder="e.g. M, L, ผ้าห่ม"
          list="product-categories"
          style={inputStyle}
        />
        <datalist id="product-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <label style={labelStyle}>Product name</label>
        <input
          type="text"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder="Product name"
          style={inputStyle}
        />
        <label style={labelStyle}>Price (฿)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={productPrice}
          onChange={(e) => setProductPrice(e.target.value)}
          placeholder="0"
          style={inputStyle}
        />
        <button type="submit" disabled={productSubmitting} style={buttonStyle}>
          {productSubmitting ? "Creating…" : "Create Product"}
        </button>
        {productMessage && <p style={{ marginTop: 12, color: productMessage.startsWith("Product created") ? "#22c55e" : "#f59e0b" }}>{productMessage}</p>}
      </form>

      <form onSubmit={handleCreateUser} style={sectionStyle}>
        <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Create Account</h2>
        <label style={labelStyle}>Email (login)</label>
        <input
          type="email"
          value={userEmail}
          onChange={(e) => setUserEmail(e.target.value)}
          placeholder="user@example.com"
          style={inputStyle}
        />
        <label style={labelStyle}>Password</label>
        <input
          type="password"
          value={userPassword}
          onChange={(e) => setUserPassword(e.target.value)}
          placeholder="Password"
          style={inputStyle}
        />
        <label style={labelStyle}>Name (optional)</label>
        <input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="Display name"
          style={inputStyle}
        />
        <label style={labelStyle}>Role</label>
        <select
          value={userRole}
          onChange={(e) => setUserRole(e.target.value)}
          style={{ ...inputStyle, marginBottom: 16 }}
        >
          <option value="sale">Sale</option>
          <option value="account">Account</option>
          <option value="pack">Pack</option>
          <option value="manager">Manager</option>
        </select>
        <button type="submit" disabled={userSubmitting} style={buttonStyle}>
          {userSubmitting ? "Creating…" : "Create Account"}
        </button>
        {userMessage && <p style={{ marginTop: 12, color: userMessage.startsWith("Account created") ? "#22c55e" : "#f59e0b" }}>{userMessage}</p>}
      </form>

      <form onSubmit={handleCreateFreebie} style={sectionStyle}>
        <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Create Freebie</h2>
        <label style={labelStyle}>Freebie name</label>
        <input
          type="text"
          value={newFreebieName}
          onChange={(e) => setNewFreebieName(e.target.value)}
          placeholder="เช่น น้ำยาซักผ้า, หมอนรองคอ"
          style={inputStyle}
        />
        <button type="submit" disabled={freebieSubmitting} style={buttonStyle}>
          {freebieSubmitting ? "Creating…" : "Create Freebie"}
        </button>
        {freebieMessage && <p style={{ marginTop: 12, color: freebieMessage.startsWith("Freebie created") ? "#22c55e" : "#f59e0b" }}>{freebieMessage}</p>}
        {freebies.length > 0 && (
          <p style={{ marginTop: 12, fontSize: 13, color: "#9ca3af" }}>
            Existing freebies: {freebies.map((f) => f.name).join(", ")}
          </p>
        )}
      </form>

      <form onSubmit={handleDeleteOrders} style={{ ...sectionStyle, borderColor: "#555" }}>
        <h2 style={{ margin: "0 0 16px", fontSize: 18, color: "#f59e0b" }}>Delete Order(s)</h2>
        <p style={{ fontSize: 13, color: "#999", marginBottom: 12 }}>
          Permanently remove an order and all related data (items, freebies, payment, files, logs, alerts). Manager only.
        </p>
        <label style={labelStyle}>Order ID or code</label>
        <input
          type="text"
          value={orderIdsToDelete}
          onChange={(e) => setOrderIdsToDelete(e.target.value)}
          placeholder="e.g. 123 or SG-26-03-08-00001 (comma/space for multiple)"
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={deleteSubmitting}
          style={{ ...buttonStyle, background: "#b91c1c" }}
        >
          {deleteSubmitting ? "Deleting…" : "Delete order(s)"}
        </button>
        {deleteMessage && (
          <p style={{ marginTop: 12, color: deleteMessage.startsWith("Deleted") && !deleteMessage.includes("failed") ? "#22c55e" : "#f59e0b" }}>
            {deleteMessage}
          </p>
        )}
      </form>

      <form onSubmit={handleAddPageName} style={sectionStyle}>
        <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Page name list (for Create Order)</h2>
        <label style={labelStyle}>เพิ่มชื่อเพจ</label>
        <input
          type="text"
          value={newPageName}
          onChange={(e) => setNewPageName(e.target.value)}
          placeholder="เช่น เพจหลัก, เพจโปรฯ, TikTok A"
          style={inputStyle}
        />
        <button type="submit" style={buttonStyle}>
          เพิ่มชื่อเพจ
        </button>
        {pageNameMessage && (
          <p style={{ marginTop: 12, color: "#fbbf24", fontSize: 13 }}>{pageNameMessage}</p>
        )}
        {pageNames.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "#9ca3af" }}>รายชื่อเพจที่มีอยู่:</p>
            <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
              {pageNames.map(({ id, name }) => (
                <li
                  key={id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "4px 0",
                    fontSize: 13,
                  }}
                >
                  <span>{name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemovePageName(name)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#f97316",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    ลบ
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </div>
  );
}
