import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
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

type LineConfigRow = {
  id?: number;
  category: string;
  lineToken: string;
  groupId: string;
  note?: string;
  isActive: boolean;
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  background: "#1a1a1a",
  fontFamily: "system-ui, -apple-system, sans-serif",
  color: "#eee",
};

const cardStyle: React.CSSProperties = {
  maxWidth: 800,
  margin: "0 auto",
  background: "#252525",
  border: "1px solid #444",
  borderRadius: 12,
  padding: 24,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  marginBottom: 12,
};

const helperTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#9ca3af",
  marginBottom: 16,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: 8,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  fontSize: 13,
  color: "#9ca3af",
  borderBottom: "1px solid #444",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #333",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #555",
  background: "#111827",
  color: "#e5e7eb",
  fontSize: 13,
  boxSizing: "border-box",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: 16,
  gap: 12,
  flexWrap: "wrap",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 6,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontSize: 14,
  cursor: "pointer",
};

const secondaryLinkStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 6,
  border: "1px solid #555",
  background: "#111827",
  color: "#e5e7eb",
  fontSize: 13,
  textDecoration: "none",
};

export default function LineNotificationSetupPage() {
  if (!localStorage.getItem("token")) return <Navigate to="/login" replace />;
  const role = getUserRole();
  if (role !== "manager") {
    return (
      <div style={pageStyle}>
        <div style={{ maxWidth: 600, margin: "40px auto" }}>
          <p style={{ color: "#fbbf24", marginBottom: 8 }}>
            Only Manager can access Line Notification setup.
          </p>
          <Link to="/menu" style={{ color: "#60a5fa", fontSize: 14 }}>
            ← Back to menu
          </Link>
        </div>
      </div>
    );
  }

  const [rows, setRows] = useState<LineConfigRow[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    setStatusMessage("");
    api
      .get<{ items: LineConfigRow[] }>("/line-config")
      .then((res) => {
        const items = Array.isArray(res.data?.items) ? res.data.items : [];
        const baseRows: LineConfigRow[] =
          items.map((it) => ({
            id: it.id,
            category: it.category ?? "",
            lineToken: it.lineToken ?? "",
            groupId: it.groupId ?? "",
            note: it.note ?? "",
            isActive: it.isActive ?? true,
          })) || [];
        const padded = [...baseRows];
        while (padded.length < 5) {
          padded.push({
            category: "",
            lineToken: "",
            groupId: "",
            note: "",
            isActive: true,
          });
        }
        setRows(padded.slice(0, 5));
      })
      .catch(() => {
        setRows(
          Array.from({ length: 5 }, () => ({
            category: "",
            lineToken: "",
            groupId: "",
            note: "",
            isActive: true,
          }))
        );
        setStatusMessage("ไม่สามารถโหลดการตั้งค่าจากเซิร์ฟเวอร์ได้");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (index: number, field: keyof LineConfigRow, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSave = () => {
    setStatusMessage("");
    api
      .put("/line-config", {
        items: rows.map((r) => ({
          id: r.id,
          category: r.category || null,
          line_token: r.lineToken || null,
          group_id: r.groupId || null,
          note: r.note || null,
          is_active: r.isActive,
        })),
      })
      .then(() => {
        setStatusMessage("บันทึกการตั้งค่าเรียบร้อย");
      })
      .catch(() => {
        setStatusMessage("ไม่สามารถบันทึกการตั้งค่าได้");
      });
  };

  return (
    <div style={pageStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Line Notification Setup</h1>
        <Link to="/menu" style={secondaryLinkStyle}>
          ← Back to menu
        </Link>
      </div>

        <div style={cardStyle}>
        <div style={sectionTitleStyle}>แม็ป Product category → Line Group</div>
        <p style={helperTextStyle}>
          ตั้งค่าการแจ้งเตือนไปยัง Line Group ตามประเภทสินค้า (product category) — ตอนนี้ยังเป็นเพียงหน้าตั้งค่า
          สำหรับเตรียมเชื่อมต่อกับ LINE Messaging API / LINE Notify ในอนาคต
        </p>

        {loading ? (
          <p style={{ fontSize: 13, color: "#9ca3af" }}>กำลังโหลดการตั้งค่า…</p>
        ) : (
          <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Product category</th>
              <th style={thStyle}>Line token</th>
              <th style={thStyle}>Group ID / Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <td style={tdStyle}>
                  <input
                    style={inputStyle}
                    placeholder="เช่น ตู้อบ / ผ้าห่ม / Redlight"
                    value={row.category}
                    onChange={(e) => handleChange(idx, "category", e.target.value)}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    style={inputStyle}
                    placeholder="Line token สำหรับ group นี้"
                    value={row.lineToken}
                    onChange={(e) => handleChange(idx, "lineToken", e.target.value)}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    style={inputStyle}
                    placeholder="Group ID หรือบันทึกเพิ่มเติม"
                    value={row.groupId}
                    onChange={(e) => handleChange(idx, "groupId", e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}

        <div style={buttonRowStyle}>
          <button type="button" onClick={handleSave} style={primaryButtonStyle}>
            Save setup (local)
          </button>
          {statusMessage && (
            <span style={{ fontSize: 12, color: "#9ca3af" }}>
              {statusMessage}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

