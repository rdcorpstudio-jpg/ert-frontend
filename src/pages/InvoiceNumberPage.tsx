import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "../services/api";

type InvoiceRow = {
  id: number;
  order_code: string;
  customer_name: string | null;
  sale_id?: number | null;
  invoice_number?: string | null;
  payment_status?: string | null;
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

export default function InvoiceNumberPage() {
  const role = getUserRole();
  const canAccess = role === "account" || role === "manager";

  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [keyword, setKeyword] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("");

  const fetchRows = () => {
    if (!canAccess) return;
    setLoading(true);
    setError(null);
    api
      .get<InvoiceRow[]>("/orders/invoice-number-pending")
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setRows(list);
        const nextDrafts: Record<number, string> = {};
        list.forEach((r) => {
          nextDrafts[r.id] = r.invoice_number ?? "";
        });
        setDrafts(nextDrafts);
      })
      .catch(() => setError("Failed to load orders without invoice number."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRows();
  }, [canAccess]);

  const handleSave = async (row: InvoiceRow) => {
    const value = (drafts[row.id] ?? "").trim();
    if (!value) {
      alert("Please fill invoice number.");
      return;
    }
    setSavingId(row.id);
    setError(null);
    try {
      await api.put(`/orders/${row.id}/invoice-number`, { invoice_number: value });
      fetchRows();
    } catch {
      setError("Failed to save invoice number.");
    } finally {
      setSavingId(null);
    }
  };

  if (!localStorage.getItem("token")) return <Navigate to="/login" replace />;
  if (!canAccess) return <Navigate to="/menu" replace />;

  const pageStyle: React.CSSProperties = {
    padding: 24,
    maxWidth: 1100,
    margin: "0 auto",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#eee",
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

  const tableWrapStyle: React.CSSProperties = {
    background: "#1f2933",
    border: "1px solid #374151",
    borderRadius: 12,
    overflow: "hidden",
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
    background: "#111827",
    borderBottom: "1px solid #374151",
  };

  const tdStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderBottom: "1px solid #374151",
  };

  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    const matchesKeyword =
      !normalizedKeyword ||
      row.order_code.toLowerCase().includes(normalizedKeyword) ||
      (row.customer_name ?? "").toLowerCase().includes(normalizedKeyword) ||
      // customer phone not in this payload; keep placeholder for future
      false;
    const matchesPayment =
      !paymentStatusFilter || (row.payment_status ?? "") === paymentStatusFilter;
    return matchesKeyword && matchesPayment;
  });

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Invoice Number</h1>
        <div style={{ display: "flex", gap: 10 }}>
          <Link to="/orders" style={linkStyle}>
            ← Order List
          </Link>
          <Link to="/menu" style={linkStyle}>
            Menu
          </Link>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: 10,
            marginBottom: 16,
            background: "#3b0000",
            color: "#fee2e2",
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Search order ID, customer name, phone…"
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #4b5563",
            background: "#111827",
            color: "#e5e7eb",
            fontSize: 13,
            minWidth: 260,
            flex: 1,
            maxWidth: 360,
          }}
        />
        <span style={{ color: "#9ca3af", fontSize: 13 }}>Payment status:</span>
        <select
          value={paymentStatusFilter}
          onChange={(e) => setPaymentStatusFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #4b5563",
            background: "#111827",
            color: "#e5e7eb",
            fontSize: 13,
            minWidth: 160,
          }}
        >
          <option value="">All</option>
          <option value="Unchecked">Unchecked</option>
          <option value="Checked">Checked</option>
          <option value="Paid">Paid</option>
          <option value="Received">Received</option>
          <option value="Unmatched">Unmatched</option>
        </select>
      </div>

      <div style={tableWrapStyle}>
        <div
          style={{
            padding: "12px 14px",
            fontWeight: 600,
            borderBottom: "1px solid #374151",
          }}
        >
          Orders that don&apos;t have invoice number yet ({filteredRows.length})
        </div>
        {loading ? (
          <p style={{ padding: 16, color: "#9ca3af", margin: 0 }}>Loading…</p>
        ) : filteredRows.length === 0 ? (
          <p style={{ padding: 16, color: "#9ca3af", margin: 0 }}>No orders.</p>
        ) : (
          <div style={{ maxHeight: 500, overflow: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Order ID</th>
                  <th style={thStyle}>Customer</th>
                  <th style={thStyle}>Payment status</th>
                  <th style={thStyle}>Invoice number</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td style={tdStyle}>{row.order_code}</td>
                    <td style={tdStyle}>{row.customer_name ?? "-"}</td>
                    <td style={tdStyle}>{row.payment_status ?? "-"}</td>
                    <td style={tdStyle}>
                      <input
                        type="text"
                        value={drafts[row.id] ?? ""}
                        onChange={(e) =>
                          setDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))
                        }
                        style={{
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "1px solid #4b5563",
                          background: "#111827",
                          color: "#e5e7eb",
                          fontSize: 13,
                          minWidth: 160,
                        }}
                      />
                    </td>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        onClick={() => handleSave(row)}
                        disabled={savingId === row.id}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          border: "1px solid #2563eb",
                          background: "#2563eb",
                          color: "#fff",
                          fontSize: 13,
                          cursor: savingId === row.id ? "default" : "pointer",
                          opacity: savingId === row.id ? 0.7 : 1,
                        }}
                      >
                        {savingId === row.id ? "Saving…" : "Save"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

