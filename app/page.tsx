"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock3, FileSpreadsheet, FolderOpen, Grid2X2, Home, Plus, Users } from "lucide-react";
import { useRef, useState } from "react";
import { importWorkbookFile } from "@/lib/workbook-io";

const workbooks = [
  {
    id: "demo-workbook",
    name: "Financial Model",
    updatedAt: "Just now",
    owner: "You"
  }
];

export default function DashboardPage() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<"home" | "recents" | "shared">("home");
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  };

  return (
    <main className="grid min-h-dvh grid-cols-1 bg-[#f3f4f2] text-neutral-950 md:grid-cols-[180px_1fr]">
      <aside className="border-b border-neutral-200 bg-[#e8edea] px-4 py-4 md:border-b-0 md:border-r md:py-8">
        <div className="mb-8 flex items-center gap-2 text-sm font-bold text-[#217346]">
          <FileSpreadsheet className="h-5 w-5" />
          Atom Sheets
        </div>
        <nav className="flex gap-2 overflow-x-auto text-sm font-medium text-neutral-700 md:block md:space-y-2">
          {[
            { label: "Home", icon: Home, action: () => setActiveView("home"), active: activeView === "home" },
            { label: "New", icon: Plus, href: "/demo-workbook" },
            { label: "Recents", icon: Clock3, action: () => setActiveView("recents"), active: activeView === "recents" },
            { label: "Shared", icon: Users, action: () => setActiveView("shared"), active: activeView === "shared" },
            { label: "Open", icon: FolderOpen, action: () => fileInputRef.current?.click() }
          ].map((item) => {
            const Icon = item.icon;
            return item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className={
                  item.active
                    ? "flex shrink-0 items-center gap-3 rounded-lg bg-white px-3 py-3 text-[#217346]"
                    : "flex shrink-0 items-center gap-3 rounded-lg px-3 py-3 hover:bg-white"
                }
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className={
                  item.active
                    ? "flex shrink-0 items-center gap-3 rounded-lg bg-white px-3 py-3 text-[#217346]"
                    : "flex shrink-0 items-center gap-3 rounded-lg px-3 py-3 hover:bg-white"
                }
              >
                <Icon className="h-5 w-5" />
                {item.label}
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
                event.currentTarget.value = "";
              });
          }}
        />
      </aside>
      <section className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold">Microsoft Excel-style start</h1>
          <Link
            href="/demo-workbook"
            className="rounded-md bg-[#217346] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#195c37] focus:outline-none focus:ring-2 focus:ring-[#217346] focus:ring-offset-2"
          >
            New workbook
          </Link>
        </div>
        <div className="mt-7 border-b border-neutral-300 pb-7">
          <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Grid2X2 className="h-5 w-5 text-[#217346]" />
            Templates
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            {["Blank Workbook", "Budget", "Task List", "Sales Report", "Project Plan", "Invoice"].map((template, index) => (
              <Link key={template} href="/demo-workbook" className="group">
                <div className="h-28 rounded-lg border border-neutral-200 bg-white p-3 transition group-hover:border-[#217346]">
                  <div className="grid h-full grid-cols-4 grid-rows-5 overflow-hidden rounded border border-neutral-300">
                    {Array.from({ length: 20 }, (_, cellIndex) => (
                      <span
                        key={cellIndex}
                        className={
                          cellIndex < 4
                            ? index % 2 === 0
                              ? "border border-white/50 bg-[#217346]/80"
                              : "border border-white/50 bg-[#4aa3df]/80"
                            : "border border-neutral-200 bg-white"
                        }
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-2 text-center text-sm font-medium">{template}</div>
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-6 flex items-center gap-2 overflow-x-auto">
          {[
            ["recents", "Recents"],
            ["home", "Favourites"],
            ["shared", "Shared with me"]
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={
                activeView === id
                  ? "rounded-md bg-[#217346] px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-md px-4 py-2 text-sm font-semibold text-neutral-500 hover:bg-white"
              }
              onClick={() => setActiveView(id as "home" | "recents" | "shared")}
            >
              {label}
            </button>
          ))}
        </div>
        <section className="mt-3 overflow-hidden border-t border-neutral-200 bg-white">
          <div className="hidden grid-cols-[1fr_180px_180px] border-b border-neutral-200 px-4 py-3 text-xs font-semibold uppercase text-neutral-500 sm:grid">
            <span>Name</span>
            <span>Owner</span>
            <span>Last opened</span>
          </div>
          {activeView === "shared" ? (
            <div className="px-4 py-10 text-sm text-neutral-500">No shared workbooks yet.</div>
          ) : (
            workbooks.map((workbook) => (
          <Link
            key={workbook.id}
            href={`/${workbook.id}`}
              className="grid gap-2 px-4 py-4 text-sm transition hover:bg-neutral-50 focus:bg-green-50 focus:outline-none sm:grid-cols-[1fr_180px_180px]"
          >
              <span className="flex items-center gap-3 font-medium">
                <FileSpreadsheet className="h-5 w-5 text-[#217346]" />
                {workbook.name}
              </span>
            <span className="text-neutral-600">{workbook.owner}</span>
            <span className="text-neutral-600">{workbook.updatedAt}</span>
          </Link>
            ))
          )}
        </section>
      </section>
      {notice ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-neutral-950 px-4 py-2 text-sm font-medium text-white">
          {notice}
        </div>
      ) : null}
    </main>
  );
}
