import React from "react";
import { Link, Navigate } from "react-router-dom";

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

export default function MenuPage() {
  if (!localStorage.getItem("token")) return <Navigate to="/login" replace />;
  const role = getUserRole();
  const isManager = role === "manager";
  const canAccessAccountant = role === "account" || role === "manager";
  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "#1a1a1a",
    fontFamily: "system-ui, -apple-system, sans-serif",
  };

  const cardWrapStyle: React.CSSProperties = {
    display: "flex",
    gap: 24,
    flexWrap: "wrap",
    justifyContent: "center",
  };

  const cardStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 220,
    minHeight: 160,
    padding: 32,
    background: "#252525",
    border: "1px solid #444",
    borderRadius: 12,
    textDecoration: "none",
    color: "#eee",
    transition: "background 0.2s, border-color 0.2s",
  };

  const iconStyle: React.CSSProperties = {
    fontSize: 48,
    marginBottom: 16,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 8,
  };

  const descStyle: React.CSSProperties = {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  };

  return (
    <div style={pageStyle}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <img
          src="https://images2.imgbox.com/23/c3/w7rGf8bp_o.png"
          alt="SG ERP logo"
          style={{ maxWidth: 260, width: "100%", height: "auto" }}
        />
      </div>
      <div style={cardWrapStyle}>
        {(role === "sale" || role === "manager") && (
          <Link
            to="/orders/create"
            style={cardStyle}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "#2a2a2a";
              e.currentTarget.style.borderColor = "#2563eb";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "#252525";
              e.currentTarget.style.borderColor = "#444";
            }}
          >
            <span style={iconStyle}>📝</span>
            <span style={labelStyle}>สร้างออเดอร์ใหม่</span>
            <span style={descStyle}>Create a new order</span>
          </Link>
        )}
        {(role === "sale" || role === "manager") && (
          <Link
            to="/sale-summary"
            style={cardStyle}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "#2a2a2a";
              e.currentTarget.style.borderColor = "#2563eb";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "#252525";
              e.currentTarget.style.borderColor = "#444";
            }}
          >
            <span style={iconStyle}>📈</span>
            <span style={labelStyle}>Sale Summary</span>
            <span style={descStyle}>ยอดขายตามพนักงานขาย</span>
          </Link>
        )}
        <Link
          to="/orders"
          style={cardStyle}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "#2a2a2a";
            e.currentTarget.style.borderColor = "#2563eb";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "#252525";
            e.currentTarget.style.borderColor = "#444";
          }}
        >
          <span style={iconStyle}>📋</span>
          <span style={labelStyle}>รายการออเดอร์ทั้งหมด</span>
          <span style={descStyle}>Search and view orders</span>
        </Link>
        {canAccessAccountant && (
          <>
            <Link
              to="/dashboard"
              style={cardStyle}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "#2a2a2a";
                e.currentTarget.style.borderColor = "#2563eb";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "#252525";
                e.currentTarget.style.borderColor = "#444";
              }}
            >
              <span style={iconStyle}>📊</span>
              <span style={labelStyle}>Dashboard</span>
              <span style={descStyle}>Revenue by status</span>
            </Link>
            <Link
              to="/orders/accountant"
              style={cardStyle}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "#2a2a2a";
                e.currentTarget.style.borderColor = "#2563eb";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "#252525";
                e.currentTarget.style.borderColor = "#444";
              }}
            >
              <span style={iconStyle}>📒</span>
              <span style={labelStyle}>ฝ่ายบัญชี</span>
              <span style={descStyle}>เช็คสถานะการชำระเงินของออเดอร์</span>
            </Link>
            <Link
              to="/orders/invoice-submit"
              style={cardStyle}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "#2a2a2a";
                e.currentTarget.style.borderColor = "#2563eb";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "#252525";
                e.currentTarget.style.borderColor = "#444";
              }}
            >
              <span style={iconStyle}>📄</span>
              <span style={labelStyle}>อัพโหลดใบกำกับภาษี</span>
              <span style={descStyle}>อัพโหลดใบกำกับภาษีของออเดอร์ที่ต้องการ</span>
            </Link>
          </>
        )}
        {(role === "pack" || role === "manager") && (
          <Link
            to="/orders/packing"
            style={cardStyle}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "#2a2a2a";
              e.currentTarget.style.borderColor = "#2563eb";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "#252525";
              e.currentTarget.style.borderColor = "#444";
            }}
          >
            <span style={iconStyle}>📦</span>
            <span style={labelStyle}>ออร์เดอร์ที่ต้องแพ็ควันนี้</span>
            <span style={descStyle}>สำหรับทีมแพ็ค</span>
          </Link>
        )}
        {(role === "pack" || role === "manager") && (
          <Link
            to="/orders/tracking"
            style={cardStyle}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "#2a2a2a";
              e.currentTarget.style.borderColor = "#2563eb";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "#252525";
              e.currentTarget.style.borderColor = "#444";
            }}
          >
            <span style={iconStyle}>🔢</span>
            <span style={labelStyle}>กรอก Tracking Number</span>
            <span style={descStyle}>สำหรับทีมแพ็ค</span>
          </Link>
        )}
        {isManager && (
          <>
            <Link
              to="/dev"
              style={cardStyle}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "#2a2a2a";
                e.currentTarget.style.borderColor = "#2563eb";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "#252525";
                e.currentTarget.style.borderColor = "#444";
              }}
            >
              <span style={iconStyle}>⚙️</span>
              <span style={labelStyle}>Dev</span>
              <span style={descStyle}>Create product, category &amp; account (Manager only)</span>
            </Link>
            <Link
              to="/line-notification-setup"
              style={cardStyle}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "#2a2a2a";
                e.currentTarget.style.borderColor = "#2563eb";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "#252525";
                e.currentTarget.style.borderColor = "#444";
              }}
            >
              <span style={iconStyle}>💬</span>
              <span style={labelStyle}>Line Notification</span>
              <span style={descStyle}>Setup per product category (Manager only)</span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
