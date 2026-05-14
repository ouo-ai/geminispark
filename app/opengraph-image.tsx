import { ImageResponse } from "next/og"

export const runtime = "edge"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#090b12",
          color: "#f8fafc",
          padding: 72,
          fontFamily: "Inter, Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(245,180,50,0.28), transparent 38%), linear-gradient(315deg, rgba(58,190,220,0.24), transparent 42%)",
          }}
        />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 18, fontSize: 34 }}>
          <div
            style={{
              width: 54,
              height: 54,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(245,180,50,0.55)",
              borderRadius: 14,
              color: "#f8c35f",
            }}
          >
            ✦
          </div>
          <span>Gemini Spark</span>
        </div>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, lineHeight: 1.02, maxWidth: 900, fontWeight: 700 }}>
            AI video generator for launch-ready clips
          </div>
          <div style={{ fontSize: 30, lineHeight: 1.35, maxWidth: 900, color: "#cbd5e1" }}>
            Turn prompts and public reference images into short Gemini Spark video tasks.
          </div>
        </div>
        <div style={{ position: "relative", fontSize: 24, color: "#f8c35f" }}>geminispark.ai</div>
      </div>
    ),
    size,
  )
}
