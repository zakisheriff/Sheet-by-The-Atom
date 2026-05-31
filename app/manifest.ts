import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sheets by The Atom",
    short_name: "Atom Sheets",
    description:
      "A fast, beautiful, collaborative spreadsheet app with Excel-style formulas, realtime sharing, and XLSX import/export.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FAFAFA",
    theme_color: "#2F7D4D",
    categories: ["productivity", "business", "utilities"],
    icons: [
      {
        src: "/Logo.png",
        sizes: "1254x1254",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/Logo.png",
        sizes: "1254x1254",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
