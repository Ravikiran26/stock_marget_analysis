import { ImageResponse } from "next/og"

export const runtime = "edge"

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #060c18 0%, #0f1b35 50%, #0a0f20 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Logo row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28,
          }}>📈</div>
          <span style={{ color: "white", fontSize: 32, fontWeight: 700, letterSpacing: -1 }}>
            Traders Diary
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          color: "white", fontSize: 60, fontWeight: 900,
          textAlign: "center", margin: "0 0 20px", lineHeight: 1.1, letterSpacing: -2,
        }}>
          AI Trade Journal<br />for Indian Traders
        </h1>

        {/* Sub */}
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 26, textAlign: "center", margin: "0 0 48px" }}>
          Analyse every trade. Review your behaviour. Educational tool.
        </p>

        {/* Broker pills */}
        <div style={{ display: "flex", gap: 16 }}>
          {["Zerodha", "Upstox", "Dhan"].map((b) => (
            <div key={b} style={{
              background: "rgba(99,102,241,0.15)",
              border: "1px solid rgba(99,102,241,0.35)",
              borderRadius: 999, padding: "10px 24px",
              color: "#a5b4fc", fontSize: 20, fontWeight: 600,
            }}>{b}</div>
          ))}
        </div>

        {/* Free badge */}
        <div style={{
          marginTop: 32,
          background: "rgba(34,197,94,0.15)",
          border: "1px solid rgba(34,197,94,0.3)",
          borderRadius: 999, padding: "8px 20px",
          color: "#4ade80", fontSize: 18, fontWeight: 600,
        }}>
          Free to start · 10 AI analyses included
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
