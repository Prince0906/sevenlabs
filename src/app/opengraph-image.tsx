import { ImageResponse } from "next/og";

export const alt = "Aloud — Interview prep, out loud";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#15181E";
const PAPER = "#F7F8FB";
const COBALT = "#2B50F0";
const TRIO = ["#ED7A1E", "#3AA4EC", "#199D5C"];

// Branded social-share card, generated at request time (no raster asset).
// Chalk & Cobalt: paper ground, ink game-piece frame, flat trio bands.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: PAPER,
          padding: 48,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            background: "#FFFFFF",
            border: `6px solid ${INK}`,
            borderRadius: 28,
            boxShadow: `16px 16px 0 ${INK}`,
            padding: 64,
            color: INK,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            <span>Aloud</span>
            <span style={{ color: COBALT }}>.</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 76,
                fontWeight: 700,
                lineHeight: 1.02,
                letterSpacing: -2,
                maxWidth: 900,
              }}
            >
              Get judged before it counts.
            </div>
            <div
              style={{
                marginTop: 26,
                fontSize: 30,
                color: "#5C6673",
              }}
            >
              A live three-interviewer panel — the level you read as, before
              it&apos;s real.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            {TRIO.map((c, i) => (
              <div
                key={c}
                style={{
                  display: "flex",
                  width: 150,
                  height: 14,
                  borderRadius: 999,
                  background: c,
                  opacity: i === 2 ? 1 : 0.35,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
