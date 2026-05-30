import { SpreadsheetDocument } from "@/components/SpreadsheetDocument";

type WorkbookPageProps = {
  params: {
    workbookId: string;
  };
};

export default function WorkbookPage({ params }: WorkbookPageProps) {
  return <SpreadsheetDocument workbookId={params.workbookId} />;
}
