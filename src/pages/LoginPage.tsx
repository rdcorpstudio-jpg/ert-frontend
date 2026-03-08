import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const res = await api.post("/auth/login", formData, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      localStorage.setItem("token", res.data.access_token);
      navigate("/menu");
    } catch {
      setError("Login failed. Please check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "linear-gradient(145deg, #0f0f0f 0%, #1a1a2e 50%, #0f0f0f 100%)",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    boxSizing: "border-box",
  };

  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 400,
    padding: "clamp(24px, 6vw, 40px)",
    background: "rgba(30, 30, 40, 0.95)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: 16,
    boxShadow: "0 24px 48px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.03) inset",
  };

  const titleStyle: React.CSSProperties = {
    margin: "0 0 8px",
    fontSize: "clamp(24px, 5vw, 28px)",
    fontWeight: 700,
    color: "#f0f0f0",
    letterSpacing: "-0.02em",
  };

  const subtitleStyle: React.CSSProperties = {
    margin: "0 0 28px",
    fontSize: 14,
    color: "#888",
  };

  const formStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 500,
    color: "#aaa",
    marginBottom: 6,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 16px",
    fontSize: 16,
    color: "#eee",
    background: "#252530",
    border: "1px solid #3a3a4a",
    borderRadius: 10,
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s, box-shadow 0.2s",
  };

  const buttonStyle: React.CSSProperties = {
    marginTop: 8,
    padding: "14px 24px",
    fontSize: 16,
    fontWeight: 600,
    color: "#fff",
    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    transition: "opacity 0.2s, transform 0.1s",
  };

  const errorStyle: React.CSSProperties = {
    marginTop: 4,
    padding: "10px 14px",
    fontSize: 13,
    color: "#fca5a5",
    background: "rgba(239, 68, 68, 0.15)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: 8,
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Welcome back</h1>
        <p style={subtitleStyle}>Sign in to continue</p>

        <form style={formStyle} onSubmit={handleLogin}>
          <div>
            <label htmlFor="login-email" style={labelStyle}>
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#2563eb";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.2)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#3a3a4a";
                e.currentTarget.style.boxShadow = "none";
              }}
              style={inputStyle}
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="login-password" style={labelStyle}>
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#2563eb";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(37, 99, 235, 0.2)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#3a3a4a";
                e.currentTarget.style.boxShadow = "none";
              }}
              style={inputStyle}
              disabled={loading}
            />
          </div>

          {error && <div style={errorStyle}>{error}</div>}

          <button
            type="submit"
            onClick={() => handleLogin()}
            disabled={loading}
            style={buttonStyle}
            onMouseDown={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseUp={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
