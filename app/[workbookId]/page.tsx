import type { Metadata } from "next";
import { SpreadsheetDocument } from "@/components/SpreadsheetDocument";

type WorkbookPageProps = {
  params: {
    workbookId: string;
  };
};

export function generateMetadata({ params }: WorkbookPageProps): Metadata {
  if (params.workbookId === "demo-workbook") {
    return {
      title: "Live Spreadsheet Demo",
      description:
        "Try Sheets by The Atom, a collaborative online spreadsheet app for Sri Lanka with Excel-style formulas, realtime editing, and XLSX import/export.",
      alternates: {
        canonical: "/demo-workbook"
      }
    };
  }

  return {
    title: "Shared Workbook",
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false
      }
    }
  };
}

export default function WorkbookPage({ params }: WorkbookPageProps) {
  return <SpreadsheetDocument workbookId={params.workbookId} />;
}
