import { ImageResponse } from "next/og";

import { appName, appSuffix, appSuperscript } from "@/lib/branding";

const ICON_TAGLINE = "Mobile Einsatzplattform";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 44,
          background:
            "linear-gradient(180deg, #f5fbf7 0%, #e7f5eb 42%, #d9efe1 100%)",
          color: "#07120a",
          fontFamily: "Arial, sans-serif",
          borderRadius: 120,
          border: "10px solid rgba(35,127,69,0.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 46,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: -1.6,
              }}
            >
              {appName}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 74,
                fontWeight: 800,
                lineHeight: 1,
                color: "#237f45",
                letterSpacing: -2.4,
              }}
            >
              {appSuffix}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 38,
              fontWeight: 900,
              color: "#ef4444",
              lineHeight: 1,
            }}
          >
            {appSuperscript}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              height: 16,
              borderRadius: 999,
              background: "rgba(35,127,69,0.14)",
              overflow: "hidden",
            }}
          >
            <div style={{ width: "68%", background: "#237f45" }} />
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              color: "#466353",
              lineHeight: 1.25,
            }}
          >
            {ICON_TAGLINE}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
