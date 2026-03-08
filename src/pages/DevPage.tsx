import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

  useEffect(() => {
    if (!isManager) return;
    api.get<Array<{ category?: string | null }>>("/products").then((res) => {
      const list = Array.isArray(res.data) ? res.data : [];
      const cats = [...new Set(list.map((p) => p.category).filter(Boolean) as string[])].sort();
      setCategories(cats);
    }).catch(() => setCategories([]));
  }, [isManager]);

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
        <h1 style={{ margin: 0, fontSize: 22 }}>Dev — Create Product &amp; Account</h1>
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
    </div>
  );
}
