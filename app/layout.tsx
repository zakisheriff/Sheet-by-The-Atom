import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";

const siteUrl = "https://sheets.theatom.lk";
const siteName = "Sheets by The Atom";
const siteDescription =
  "Sheets by The Atom is a fast, beautiful, collaborative spreadsheet app for Sri Lanka and modern teams, with Excel-style formulas, Google Sheets-style sharing, realtime editing, and XLSX import/export.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: {
    default: "Sheets by The Atom | Collaborative Spreadsheet App in Sri Lanka",
    template: "%s | Sheets by The Atom"
  },
  description: siteDescription,
  keywords: [
    "Sheets by The Atom",
    "Atom Sheets",
    "sheets sri lanka",
    "spreadsheet Sri Lanka",
    "online spreadsheet",
    "collaborative spreadsheet",
    "Excel alternative",
    "Google Sheets alternative",
    "XLSX editor",
    "CSV editor",
    "financial model spreadsheet",
    "realtime spreadsheet",
    "The Atom"
  ],
  authors: [{ name: "The Atom", url: "https://theatom.lk" }],
  creator: "The Atom",
  publisher: "The Atom",
  category: "productivity",
  alternates: {
    canonical: siteUrl
  },
  icons: {
    icon: [
      { url: "/Logo.png", type: "image/png", sizes: "1254x1254" },
      { url: "/Logo.png", type: "image/png" }
    ],
    shortcut: "/Logo.png",
    apple: [{ url: "/Logo.png", type: "image/png", sizes: "1254x1254" }]
  },
  openGraph: {
    type: "website",
    locale: "en_LK",
    url: siteUrl,
    siteName,
    title: "Sheets by The Atom | Collaborative Spreadsheet App in Sri Lanka",
    description: siteDescription,
    images: [
      {
        url: "/Logo.png",
        width: 1254,
        height: 1254,
        alt: "Sheets by The Atom logo"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Sheets by The Atom | Collaborative Spreadsheet App in Sri Lanka",
    description: siteDescription,
    images: ["/Logo.png"]
  },
  appleWebApp: {
    capable: true,
    title: siteName,
    statusBarStyle: "default"
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#2F7D4D"
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "The Atom",
        url: "https://theatom.lk",
        logo: `${siteUrl}/Logo.png`
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: siteName,
        description: siteDescription,
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: "en-LK"
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${siteUrl}/#software`,
        name: siteName,
        alternateName: ["Atom Sheets", "Sheets Sri Lanka"],
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: siteUrl,
        image: `${siteUrl}/Logo.png`,
        description: siteDescription,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD"
        },
        featureList: [
          "Realtime collaborative spreadsheet editing",
          "Excel-style formulas",
          "XLSX, CSV, TSV, JSON import and export",
          "Google Drive sharing",
          "Canvas-rendered virtualized grid",
          "Mobile-friendly spreadsheet editing"
        ],
        publisher: { "@id": `${siteUrl}/#organization` }
      }
    ]
  };

  return (
    <html lang="en">
      <body>
        <Script
          id="structured-data"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
