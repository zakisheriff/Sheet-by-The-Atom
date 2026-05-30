"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Calculator,
  Clock3,
  FileSpreadsheet,
  FolderOpen,
  Grid2X2,
  Heart,
  Home,
  LayoutTemplate,
  Plus,
  ReceiptText,
  Rows3
} from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { createDriveShareUrl, fetchDriveFileMetadata, fetchWorkbookFromDrive, validateDriveFileId } from "@/lib/driveService";
import { importWorkbookFile } from "@/lib/workbook-io";

type DashboardView = "templates" | "recents" | "favourites";

type Template = {
  id: string;
  name: string;
  description: string;
  accent: "green" | "blue" | "amber" | "purple";
  icon: typeof FileSpreadsheet;
  rows: string[][];
};

function isErrorNotice(message: string) {
  return /error|failed|invalid|denied|access|offline|could not|can't|cannot/i.test(message);
}

const templates: Template[] = [
  {
    id: "blank-workbook",
    name: "Blank Workbook",
    description: "Start from a clean sheet.",
    accent: "green",
    icon: Grid2X2,
    rows: [[""]]
  },
  {
    id: "budget",
    name: "Budget",
    description: "Track income, expenses, and balance.",
    accent: "blue",
    icon: Calculator,
    rows: [
      ["Category", "Planned", "Actual", "Difference"],
      ["Income", "5000", "5200", "=C2-B2"],
      ["Rent", "1600", "1600", "=C3-B3"],
      ["Groceries", "600", "745", "=C4-B4"],
      ["Utilities", "280", "310", "=C5-B5"],
      ["Savings", "1000", "900", "=C6-B6"],
      ["Total", "=SUM(B2:B6)", "=SUM(C2:C6)", "=SUM(D2:D6)"]
    ]
  },
  {
    id: "task-list",
    name: "Task List",
    description: "Plan owners, dates, and status.",
    accent: "green",
    icon: Rows3,
    rows: [
      ["Task", "Owner", "Priority", "Due", "Status"],
      ["Research competitors", "You", "High", "2026-06-03", "In progress"],
      ["Draft launch plan", "Team", "High", "2026-06-07", "Not started"],
      ["Review pricing", "Finance", "Medium", "2026-06-10", "Not started"],
      ["Publish update", "Marketing", "Medium", "2026-06-14", "Blocked"]
    ]
  },
  {
    id: "sales-report",
    name: "Sales Report",
    description: "Quarterly sales by region.",
    accent: "blue",
    icon: BarChart3,
    rows: [
      ["Region", "Q1", "Q2", "Q3", "Q4", "Total"],
      ["North", "42000", "51000", "48000", "57000", "=SUM(B2:E2)"],
      ["South", "38000", "44000", "46000", "52000", "=SUM(B3:E3)"],
      ["West", "61000", "66000", "70000", "74000", "=SUM(B4:E4)"],
      ["East", "47000", "49000", "53000", "59000", "=SUM(B5:E5)"],
      ["Total", "=SUM(B2:B5)", "=SUM(C2:C5)", "=SUM(D2:D5)", "=SUM(E2:E5)", "=SUM(F2:F5)"]
    ]
  },
  {
    id: "project-plan",
    name: "Project Plan",
    description: "Milestones, timing, and progress.",
    accent: "purple",
    icon: LayoutTemplate,
    rows: [
      ["Milestone", "Owner", "Start", "End", "Progress"],
      ["Discovery", "Product", "2026-06-01", "2026-06-07", "100%"],
      ["Design", "Design", "2026-06-08", "2026-06-21", "65%"],
      ["Engineering", "Engineering", "2026-06-22", "2026-07-19", "20%"],
      ["Launch", "Go-to-market", "2026-07-20", "2026-07-31", "0%"]
    ]
  },
  {
    id: "invoice",
    name: "Invoice",
    description: "Line items, quantity, tax, and total.",
    accent: "amber",
    icon: ReceiptText,
    rows: [
      ["Invoice", "", "", "", ""],
      ["Client", "Acme Studio", "", "Invoice #", "ATOM-001"],
      ["Item", "Qty", "Rate", "Tax", "Line Total"],
      ["Design system", "1", "2500", "0.08", "=B4*C4*(1+D4)"],
      ["Spreadsheet build", "1", "4200", "0.08", "=B5*C5*(1+D5)"],
      ["Support", "10", "120", "0.08", "=B6*C6*(1+D6)"],
      ["Total", "", "", "", "=SUM(E4:E6)"]
    ]
  }
];

const workbooks = [
  {
    id: "demo-workbook",
    name: "Financial Model",
    updatedAt: "Just now",
    owner: "You",
    favourite: true
  }
];

const navItems: Array<{
  id: DashboardView | "new" | "open";
  label: string;
  icon: typeof Home;
}> = [
  { id: "templates", label: "Templates", icon: Home },
  { id: "new", label: "Blank Workbook", icon: Plus },
  { id: "recents", label: "Recents", icon: Clock3 },
  { id: "favourites", label: "Favourites", icon: Heart },
  { id: "open", label: "Open File", icon: FolderOpen }
];

function TemplatePreview({ template }: { template: Template }) {
  const headerColor =
    template.accent === "blue"
      ? "bg-[#5DADE2]"
      : template.accent === "amber"
        ? "bg-[#F5B041]"
        : template.accent === "purple"
          ? "bg-[#8E7BEF]"
          : "bg-[#2F7D4D]";

  return (
    <div className="rounded-[20px] border border-neutral-200 bg-white p-4 transition group-hover:-translate-y-0.5 group-hover:border-[#2F7D4D]/40 group-hover:bg-[#fbfdfb]">
      <div className="grid h-28 grid-cols-5 grid-rows-5 overflow-hidden rounded-[16px] border border-neutral-200 bg-white">
        {Array.from({ length: 25 }, (_, cellIndex) => (
          <span
            key={cellIndex}
            className={cellIndex < 5 ? `border border-white/60 ${headerColor}` : "border border-neutral-200 bg-white"}
          />
        ))}
      </div>
    </div>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeView, setActiveView] = useState<DashboardView>("templates");
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const openedDriveFileRef = useRef<string | null>(null);

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  };

  const openTemplate = (template: Template) => {
    window.localStorage.setItem(
      "atom:pending-import",
      JSON.stringify({
        name: template.name,
        rows: template.rows
      })
    );
    router.push(`/template-${template.id}`);
  };

  const handleNavAction = (id: (typeof navItems)[number]["id"]) => {
    if (id === "new") {
      openTemplate(templates[0]);
      return;
    }

    if (id === "open") {
      fileInputRef.current?.click();
      return;
    }

    setActiveView(id);
  };

  useEffect(() => {
    const fileId = searchParams.get("file");
    if (!fileId || openedDriveFileRef.current === fileId) {
      return;
    }

    openedDriveFileRef.current = fileId;
    if (!validateDriveFileId(fileId)) {
      notify("Invalid Google Drive file link");
      return;
    }

    notify("Opening Google Drive sheet...");
    void Promise.all([fetchWorkbookFromDrive(fileId), fetchDriveFileMetadata(fileId)])
      .then(([payload, metadata]) => {
        window.localStorage.setItem(
          "atom:pending-workbook-state",
          JSON.stringify({
            ...payload.workbook,
            workbookId: `drive-${fileId}`,
            driveFileId: fileId,
            driveModifiedTime: metadata.modifiedTime,
            driveShareUrl: createDriveShareUrl(fileId)
          })
        );
        router.push(`/drive-${fileId}`);
      })
      .catch((error: unknown) => {
        notify(error instanceof Error ? error.message : "Could not open Drive sheet");
      });
  }, [router, searchParams]);

  const listedWorkbooks = activeView === "favourites" ? workbooks.filter((workbook) => workbook.favourite) : workbooks;
  const noticeIsError = isErrorNotice(notice);

  return (
    <main className="grid min-h-dvh grid-cols-1 bg-[#f5f6f4] text-neutral-950 md:grid-cols-[240px_1fr]">
      <aside className="border-b border-neutral-200 bg-[#e8edea] px-4 py-4 md:border-b-0 md:border-r md:px-5 md:py-8">
        <div className="mb-8 flex h-12 items-center gap-3 rounded-[20px] px-3 text-base font-extrabold text-[#2F7D4D]">
          <FileSpreadsheet className="h-6 w-6" />
          Atom Sheets
        </div>
        <nav className="flex gap-3 overflow-x-auto text-sm font-semibold text-neutral-700 md:flex-col md:overflow-visible">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.id === activeView;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavAction(item.id)}
                className={
                  active
                    ? "flex h-14 min-w-44 shrink-0 items-center gap-3 rounded-[20px] bg-white px-4 text-[#2F7D4D] transition md:w-full"
                    : "flex h-14 min-w-44 shrink-0 items-center gap-3 rounded-[20px] px-4 text-neutral-700 transition hover:bg-white/75 md:w-full"
                }
              >
                <Icon className="h-6 w-6 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.xlsx,.xlsm,.json"
          className="hidden"
          onChange={(event) => {
            const input = event.currentTarget;
            const file = event.target.files?.[0];
            if (!file) {
              notify("No file selected");
              return;
            }
            void importWorkbookFile(file)
              .then((workbook) => {
                window.localStorage.setItem("atom:pending-import", JSON.stringify(workbook));
                notify(`Opening ${file.name}`);
                router.push("/imported-workbook");
              })
              .catch((error: unknown) => {
                notify(error instanceof Error ? error.message : "Import failed");
              })
              .finally(() => {
                input.value = "";
              });
          }}
        />
      </aside>
      <section className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Create your next workbook</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-neutral-600">
              Choose a real template, open a recent workbook, or import an existing spreadsheet.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openTemplate(templates[0])}
            className="h-14 rounded-[20px] bg-[#2F7D4D] px-6 text-sm font-bold text-white transition hover:bg-[#24643d] focus:outline-none focus:ring-2 focus:ring-[#2F7D4D] focus:ring-offset-2"
          >
            New workbook
          </button>
        </div>

        {activeView === "templates" ? (
          <section className="mt-9">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-[18px] bg-white text-[#2F7D4D]">
                <Grid2X2 className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold">Templates</h2>
                <p className="text-sm font-medium text-neutral-500">Every card opens a prefilled workbook.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {templates.map((template) => {
                const Icon = template.icon;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => openTemplate(template)}
                    className="group rounded-[24px] text-left outline-none transition focus:ring-2 focus:ring-[#2F7D4D] focus:ring-offset-4"
                  >
                    <TemplatePreview template={template} />
                    <div className="mt-3 flex items-start gap-3 px-1">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[18px] bg-white text-[#2F7D4D]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-base font-extrabold">{template.name}</div>
                        <div className="mt-0.5 text-sm font-medium text-neutral-500">{template.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="mt-9">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold">{activeView === "recents" ? "Recents" : "Favourites"}</h2>
                <p className="text-sm font-medium text-neutral-500">
                  {activeView === "recents" ? "Workbooks you opened recently." : "Your pinned workbooks."}
                </p>
              </div>
              <div className="flex rounded-[20px] bg-white p-1">
                {(["recents", "favourites"] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    className={
                      activeView === view
                        ? "h-10 rounded-[16px] bg-[#2F7D4D] px-4 text-sm font-bold capitalize text-white"
                        : "h-10 rounded-[16px] px-4 text-sm font-bold capitalize text-neutral-500 hover:bg-neutral-100"
                    }
                    onClick={() => setActiveView(view)}
                  >
                    {view}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-[24px] border border-neutral-200 bg-white">
              <div className="hidden grid-cols-[1fr_180px_180px] border-b border-neutral-200 px-6 py-4 text-xs font-bold uppercase tracking-wide text-neutral-500 sm:grid">
                <span>Name</span>
                <span>Owner</span>
                <span>Last opened</span>
              </div>
              {listedWorkbooks.length === 0 ? (
                <div className="px-6 py-14 text-sm font-medium text-neutral-500">Nothing here yet.</div>
              ) : (
                listedWorkbooks.map((workbook) => (
                  <Link
                    key={workbook.id}
                    href={`/${workbook.id}`}
                    className="grid gap-2 px-6 py-5 text-sm transition hover:bg-[#f7fbf8] focus:bg-[#edf7f0] focus:outline-none sm:grid-cols-[1fr_180px_180px]"
                  >
                    <span className="flex items-center gap-3 font-bold">
                      <FileSpreadsheet className="h-6 w-6 text-[#2F7D4D]" />
                      {workbook.name}
                    </span>
                    <span className="font-medium text-neutral-600">{workbook.owner}</span>
                    <span className="font-medium text-neutral-600">{workbook.updatedAt}</span>
                  </Link>
                ))
              )}
            </div>
          </section>
        )}
      </section>
      {notice ? (
        <div
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[18px] border px-3.5 py-2 text-xs font-semibold ${
            noticeIsError
              ? "border-red-200 bg-[#FFF1F1] text-red-700"
              : "border-neutral-800 bg-neutral-950 text-white"
          }`}
          role={noticeIsError ? "alert" : "status"}
        >
          {notice}
        </div>
      ) : null}
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#f5f6f4]" />}>
      <DashboardContent />
    </Suspense>
  );
}
