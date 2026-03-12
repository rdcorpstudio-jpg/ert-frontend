import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "../services/api";

type RevenueBySaleItem = {
  sale_id?: number;
  name: string;
  revenue: number;
};

type BreakdownItem = {
  name: string;
  revenue: number;
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

export default function SaleSummaryPage() {
  const role = getUserRole();
  const canAccess = role === "sale" || role === "manager";

  const token = localStorage.getItem("token");
  const payload = token ? JSON.parse(atob(token.split(".")[1])) : null;
  const currentSaleId: number | undefined = payload?.user_id;

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [items, setItems] = useState<RevenueBySaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSaleName, setSelectedSaleName] = useState<string | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<BreakdownItem[]>([]);
  const [pageBreakdown, setPageBreakdown] = useState<BreakdownItem[]>([]);

  const formatBath = (n: number) =>
    `฿${n.toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const fetchBreakdown = (saleId: number, from?: string, to?: string) => {
    const params: Record<string, string | number> = { sale_id: saleId };
    if (from?.trim()) params.created_from = from.trim();
    if (to?.trim()) params.created_to = to.trim();
    api
      .get<{ categories: BreakdownItem[]; pages: BreakdownItem[] }>(
        "/orders/revenue-by-sale-breakdown",
        { params }
      )
      .then((res) => {
        setCategoryBreakdown(
          Array.isArray(res.data?.categories) ? res.data.categories : []
        );
        setPageBreakdown(
          Array.isArray(res.data?.pages) ? res.data.pages : []
        );
      })
      .catch(() => {
        setCategoryBreakdown([]);
        setPageBreakdown([]);
      });
  };

  const fetchData = (from?: string, to?: string) => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = {};
    if (from?.trim()) params.created_from = from.trim();
    if (to?.trim()) params.created_to = to.trim();
    api
      .get<{ items: RevenueBySaleItem[] }>("/orders/revenue-by-sale", {
        params,
      })
      .then((res) => {
        const list = Array.isArray(res.data?.items) ? res.data.items : [];
        setItems(list);
        // For manager, keep current selection if still exists; otherwise default
        if (role === "manager") {
          let targetName = selectedSaleName;
          if (
            targetName &&
            !list.some((it) => it.name === targetName)
          ) {
            targetName = null;
          }
          if (!targetName && list.length > 0) {
            targetName = list[0].name;
          }
          setSelectedSaleName(targetName);
          // When manager focuses a single sale, also fetch its breakdown
          if (targetName) {
            const target = list.find((it) => it.name === targetName);
            if (target?.sale_id != null) {
              fetchBreakdown(target.sale_id, from, to);
            } else {
              setCategoryBreakdown([]);
              setPageBreakdown([]);
            }
          } else {
            setCategoryBreakdown([]);
            setPageBreakdown([]);
          }
        } else if (role === "sale") {
          // For sale, there should only be their own row
          if (list.length > 0) {
            setSelectedSaleName(list[0].name);
          }
          if (currentSaleId != null) {
            fetchBreakdown(currentSaleId, from, to);
          } else {
            setCategoryBreakdown([]);
            setPageBreakdown([]);
          }
        }
      })
      .catch(() => setError("Failed to load sale summary."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!canAccess) return;
    fetchData();
  }, [canAccess]);

  const handleApplyRange = () => {
    fetchData(dateFrom || undefined, dateTo || undefined);
  };

  const handleAllTime = () => {
    setDateFrom("");
    setDateTo("");
    fetchData();
  };

  if (!localStorage.getItem("token")) return <Navigate to="/login" replace />;
  if (!canAccess) {
    return (
      <div
        style={{
          padding: 24,
          maxWidth: 600,
          margin: "0 auto",
          color: "#eee",
        }}
      >
        <p style={{ color: "#f59e0b" }}>
          Only Sale or Manager can access Sale Summary.
        </p>
        <Link to="/menu" style={{ color: "#60a5fa" }}>
          ← Back to Menu
        </Link>
      </div>
    );
  }

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    padding: 24,
    background: "#1a1a1a",
    fontFamily: "system-ui, -apple-system, sans-serif",
    color: "#eee",
  };

  const cardStyle: React.CSSProperties = {
    padding: 20,
    borderRadius: 14,
    background: "#252525",
    border: "1px solid #333",
    minWidth: 220,
    minHeight: 140,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
  };

  const highlightedCard: React.CSSProperties = {
    borderColor: "#2563eb",
    boxShadow: "0 0 0 1px rgba(37,99,235,0.6), 0 16px 40px rgba(15,23,42,0.9)",
  };

  const saleCards = (() => {
    if (role === "sale") {
      return items;
    }
    if (role === "manager" && selectedSaleName) {
      return items.filter((it) => it.name === selectedSaleName);
    }
    return items;
  })();

  const totalRevenue = saleCards.reduce(
    (sum, it) => sum + (it.revenue ?? 0),
    0
  );

  return (
    <div style={pageStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Sale Summary</h1>
          <p style={{ marginTop: 6, fontSize: 13, color: "#9ca3af" }}>
            รวมยอดขายตามพนักงานขาย — เหมาะสำหรับแคปหน้าจอไปใช้ใน Canva
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
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
            Menu
          </Link>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: "#aaa", fontSize: 14 }}>Order created date:</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #555",
            background: "#252525",
            color: "#eee",
            fontSize: 14,
          }}
        />
        <span style={{ color: "#888" }}>–</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            border: "1px solid #555",
            background: "#252525",
            color: "#eee",
            fontSize: 14,
          }}
        />
        <button
          type="button"
          onClick={handleApplyRange}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Apply range
        </button>
        <button
          type="button"
          onClick={handleAllTime}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid #555",
            background: "#333",
            color: "#eee",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          All time
        </button>
        {role === "manager" && items.length > 0 && (
          <>
            <span style={{ color: "#aaa", fontSize: 14, marginLeft: 8 }}>
              Focus on:
            </span>
            <select
              value={selectedSaleName ?? ""}
              onChange={(e) => {
                const value = e.target.value || null;
                setSelectedSaleName(value);
                const target = items.find((it) => it.name === value);
                if (value && target?.sale_id != null) {
                  fetchBreakdown(
                    target.sale_id,
                    dateFrom || undefined,
                    dateTo || undefined
                  );
                } else {
                  setCategoryBreakdown([]);
                  setPageBreakdown([]);
                }
              }}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #555",
                background: "#111827",
                color: "#e5e7eb",
                fontSize: 13,
              }}
            >
              <option value="">All sales</option>
              {items.map((it) => (
                <option key={it.name || "-"} value={it.name}>
                  {it.name || "—"}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            marginBottom: 16,
            background: "#3b0000",
            color: "#fcc",
            borderRadius: 8,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: "#888" }}>Loading…</p>
      ) : saleCards.length === 0 ? (
        <p style={{ color: "#888" }}>No data in this range.</p>
      ) : (
        <>
          <div
            style={{
              marginBottom: 20,
              fontSize: 16,
              fontWeight: 600,
              color: "#e5e7eb",
            }}
          >
            รวมยอดทั้งหมดในช่วงนี้:{" "}
            <span style={{ color: "#4ade80" }}>
              {formatBath(totalRevenue)}
            </span>
          </div>
          {/* Row 1: one card per sale with total revenue (good for overview / screenshot) */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 20,
              marginBottom: 24,
            }}
          >
            {saleCards.map((it) => (
              <div
                key={it.name || "-"}
                style={{
                  ...cardStyle,
                  ...(role === "sale" || it.name === selectedSaleName
                    ? highlightedCard
                    : null),
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#e5e7eb",
                    }}
                  >
                    {it.name || "—"}
                  </span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>
                    Sale performance
                  </span>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "#9ca3af",
                      marginBottom: 4,
                    }}
                  >
                    Total revenue
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      color: "#fbbf24",
                    }}
                  >
                    {formatBath(it.revenue ?? 0)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Row 2: for the focused sale, show separate breakdown cards */}
          {saleCards.length === 1 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 20,
              }}
            >
              <div
                style={{
                  ...cardStyle,
                  minWidth: 260,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#e5e7eb",
                    marginBottom: 8,
                  }}
                >
                  By product category
                </div>
                {categoryBreakdown.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>—</div>
                ) : (
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      fontSize: 12,
                      color: "#e5e7eb",
                    }}
                  >
                    {categoryBreakdown.map((c) => (
                      <li
                        key={c.name || "-"}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <span>{c.name || "—"}</span>
                        <span style={{ color: "#fbbf24" }}>
                          {formatBath(c.revenue ?? 0)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div
                style={{
                  ...cardStyle,
                  minWidth: 260,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#e5e7eb",
                    marginBottom: 8,
                  }}
                >
                  By page name
                </div>
                {pageBreakdown.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>—</div>
                ) : (
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      fontSize: 12,
                      color: "#e5e7eb",
                    }}
                  >
                    {pageBreakdown.map((p) => (
                      <li
                        key={p.name || "-"}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <span>{p.name || "—"}</span>
                        <span style={{ color: "#fbbf24" }}>
                          {formatBath(p.revenue ?? 0)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

