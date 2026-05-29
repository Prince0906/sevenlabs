import { ImageResponse } from "next/og";

export const alt = "Aloud — Interview prep, out loud";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded social-share card, generated at request time (no raster asset).
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#1d1b18",
          color: "#ffffff",
          padding: 72,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 40,
            fontWeight: 700,
          }}
        >
          <span>Aloud</span>
          <span style={{ color: "#34d399" }}>.</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 68,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -1,
              maxWidth: 940,
            }}
          >
            Practice your FAANG answers out loud — scored like the real thing.
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 30,
              color: "rgba(255,255,255,0.62)",
            }}
          >
            See whether you read as New Grad, SDE II, or Senior.
          </div>
        </div>

        <div style={{ display: "flex" }}>
          <div
            style={{
              display: "flex",
              width: 460,
              height: 12,
              borderRadius: 999,
              backgroundImage:
                "linear-gradient(to right, #d6952b, #4b78d8, #2fa37a)",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  );
}
