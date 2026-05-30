# <div align="center">Sheets by The Atom</div>

<div align="center">
<strong>Next-generation spreadsheet web application with a custom canvas grid, real formulas, collaboration, and Excel-ready import/export</strong>
</div>

<br />

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![License](https://img.shields.io/badge/License-TBD-lightgrey?style=for-the-badge)

<br />

<a href="http://localhost:3010/demo-workbook">
<img src="https://img.shields.io/badge/Local%20Demo-Open%20Workbook-0066FF?style=for-the-badge&logo=safari&logoColor=white" height="50" />
</a>

<br />
<br />

**[GitHub Repository: Sheet by The Atom](https://github.com/zakisheriff/Sheet-by-The-Atom)**

</div>

<br />

> **"Spreadsheets should feel instant, beautiful, and powerful."**
>
> Sheet by The Atom is a production-grade spreadsheet experience built with a custom canvas renderer, Excel-compatible formulas, import/export workflows, and a refined interface inspired by Excel, Google Sheets, and Apple Numbers.

---

## 🌟 Vision

Sheet by The Atom is built to become:

- **A fast spreadsheet engine for modern teams** — large grids, smooth selection, keyboard-first workflows
- **A beautiful canvas-first spreadsheet UI** — crisp gridlines, polished controls, responsive layouts
- **A collaborative workbook platform** — presence, shared editing foundations, persistence, and auth-ready architecture

---

## ✨ Why Sheet by The Atom?

Most web spreadsheets either feel too heavy, too limited, or too generic.  
Sheet by The Atom aims for the best parts of modern spreadsheet tools:

- **Excel-like power** with formulas, ranges, fill handles, import/export, and keyboard shortcuts
- **Google Sheets-like collaboration foundations** with Yjs and live presence architecture
- **Apple Numbers-like polish** with airy spacing, soft radius, refined controls, and clean visual hierarchy

---

## 🎨 Refined Spreadsheet Design

- **Canvas-rendered grid**  
  Custom renderer built for performance instead of thousands of DOM cells.

- **Crisp spreadsheet surface**  
  White sheet canvas, subtle borders, clean headers, and high-contrast selection state.

- **Rounded product shell**  
  Soft 15–20px style radius across menus, panels, dialogs, tabs, and action surfaces.

- **Purposeful interactions**  
  Smooth selection, fill-handle feedback, range dragging, formula autocomplete, and command palette flows.

- **Responsive interface**  
  Works across desktop, tablet, and smaller browser windows with adaptive toolbar behavior.

---

## 🧮 Formula Engine

- **HyperFormula integration**  
  Excel-compatible formula calculation engine.

- **Formula bar**  
  Top formula input with current-cell address display.

- **Inline formula editing**  
  Type formulas directly inside cells.

- **Formula autocomplete**  
  Suggestions appear while typing functions such as `=SUM`, `=AVERAGE`, and more.

- **Mouse range picking**  
  While editing formulas, drag across cells to insert range references like `B2:C5`.

- **Live calculated status bar**  
  Selection stats show `SUM`, `AVERAGE`, `COUNT`, `MIN`, and `MAX`.

---

## 📊 Spreadsheet Experience

- **Canvas-based grid renderer** — no off-the-shelf spreadsheet UI library
- **Virtualized rendering** — only visible rows and columns are drawn
- **Excel-style selection** — single cell, mouse drag range, shift selection, and full-sheet select
- **Fill handle** — drag the blue corner square to copy values, formulas, and numeric series
- **Resizable rows and columns** — drag header borders like Excel
- **Keyboard navigation** — arrows, enter, tab, copy/paste, undo/redo, command palette
- **Context menu** — copy, insert row, insert column, clear contents
- **Sheet tabs** — add, rename, delete, and switch sheets
- **Undo/redo stack** — workbook snapshot history with bounded memory
- **Autosave state indicator** — dirty/saved workbook state

---

## 📥 Import & Export

Supported workbook operations:

- **Import Excel workbooks** — `.xlsx`, `.xlsm`
- **Import delimited files** — `.csv`, `.tsv`
- **Import JSON workbook data** — structured workbook payloads
- **Export Excel workbook** — `.xlsx`
- **Export Google Sheets-ready workbook** — `.xlsx`
- **Export CSV / TSV** — compatible with spreadsheet tools
- **Export JSON** — portable workbook data

---

## 🤝 Collaboration Architecture

- **Yjs CRDT foundation**  
  Conflict-free shared document model.

- **y-websocket ready**  
  Designed for real-time workbook sessions.

- **Live presence model**  
  User colors, names, and cursor positions.

- **Optimistic UI direction**  
  Local edits update immediately without blocking the grid.

---

## 🔐 Auth & Persistence Architecture

- **NextAuth.js** — authentication route and provider shell
- **Prisma** — typed database layer
- **PostgreSQL** — relational persistence target
- **Redis presence layer** — active users and collaboration state foundation
- **Environment-driven config** — production-ready secret management pattern

---

## 📁 Project Structure

```text
sheets/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root layout and providers
│   ├── page.tsx                      # Workbook dashboard
│   ├── [workbookId]/page.tsx         # Spreadsheet editor route
│   └── api/auth/[...nextauth]/route.ts
│
├── components/
│   ├── SpreadsheetDocument.tsx       # Main workbook shell
│   ├── StatusBar.tsx                 # SUM / AVERAGE / COUNT / MIN / MAX
│   ├── CommandPalette.tsx            # Cmd+K actions
│   ├── FindReplaceDialog.tsx         # Find and replace UI
│   │
│   ├── grid/
│   │   ├── Canvas.tsx                # Canvas grid renderer
│   │   ├── CellEditor.tsx            # Inline cell editor
│   │   ├── FormulaBar.tsx            # Formula input bar
│   │   ├── ColumnHeader.tsx          # Column header component
│   │   ├── RowHeader.tsx             # Row header component
│   │   └── SelectionOverlay.tsx      # Selection support layer
│   │
│   ├── toolbar/
│   │   ├── Toolbar.tsx               # Ribbon-style toolbar
│   │   ├── FontControls.tsx          # Font family, size, emphasis
│   │   └── FormatControls.tsx        # Colors, alignment, number formats
│   │
│   ├── collaboration/
│   │   ├── PresenceBar.tsx           # Active collaborators
│   │   └── LiveCursor.tsx            # Live cursor overlay
│   │
│   └── sheets/
│       └── SheetTabs.tsx             # Sheet tab management
│
├── hooks/
│   ├── useGrid.ts                    # Virtualization and hit testing
│   ├── useFormula.ts                 # Formula state helpers
│   ├── useCollaboration.ts           # Collaboration session hook
│   └── useKeyboard.ts                # Spreadsheet keyboard shortcuts
│
├── lib/
│   ├── grid.ts                       # Grid model, ranges, sizing helpers
│   ├── store.ts                      # Zustand workbook state
│   ├── hyperformula.ts               # Formula engine integration
│   ├── workbook-io.ts                # XLSX / CSV / TSV / JSON import/export
│   ├── yjs.ts                        # Yjs document and awareness setup
│   ├── db.ts                         # Prisma client
│   ├── auth.ts                       # NextAuth options
│   └── redis.ts                      # Redis client
│
├── prisma/
│   └── schema.prisma                 # Database schema
│
└── package.json
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18+
- **npm**
- **PostgreSQL** for production persistence
- **Redis** for production presence

### 1. Clone the Repository

```bash
git clone https://github.com/zakisheriff/Sheet-by-The-Atom.git
cd Sheet-by-The-Atom
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create `.env.local`:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/atom_sheets"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-secure-secret"
REDIS_URL="redis://localhost:6379"
```

### 4. Generate Prisma Client

```bash
npm run prisma:generate
```

### 5. Run the Application

```bash
npm run dev
```

Visit **http://localhost:3000/demo-workbook** 🎉

---

## 🎯 Key Features

### For Spreadsheet Users

✅ **Canvas grid** — smooth spreadsheet rendering without DOM-cell overhead  
✅ **Formula bar** — edit formulas and raw values  
✅ **Inline editing** — double-click or type directly into cells  
✅ **Formula autocomplete** — function suggestions while typing  
✅ **Mouse range selection** — drag to select cell ranges  
✅ **Formula range picking** — drag ranges directly into formulas  
✅ **Fill handle** — copy cells, formulas, and numeric series  
✅ **Resizable rows and columns** — expand headers like Excel  
✅ **Status calculations** — live SUM, AVERAGE, COUNT, MIN, MAX  
✅ **Import/export** — XLSX, CSV, TSV, JSON, Google Sheets-ready workbook  

### For Product Teams

✅ **Modern Next.js architecture** — App Router and typed components  
✅ **Strict TypeScript** — no loose typing for core spreadsheet code  
✅ **Zustand state model** — centralized workbook state and undo/redo  
✅ **HyperFormula engine** — real spreadsheet calculation foundation  
✅ **Yjs collaboration foundation** — CRDT-ready real-time editing  
✅ **Prisma persistence layer** — database-backed workbook architecture  

---

## 🔧 Tech Stack

### Frontend

- **Next.js 14** — App Router application framework
- **React 18** — UI component model
- **TypeScript** — strict typed implementation
- **Tailwind CSS** — utility-first styling
- **Canvas API** — custom spreadsheet renderer
- **Framer Motion** — polished UI animations
- **Lucide React** — icon system

### Spreadsheet Core

- **HyperFormula** — Excel-compatible calculation engine
- **Zustand** — workbook state, undo/redo, selection, editing
- **ExcelJS** — `.xlsx` import and export
- **Custom grid utilities** — addresses, ranges, resizing, formatting

### Collaboration & Backend

- **Yjs** — CRDT collaboration model
- **y-websocket** — real-time sync transport
- **NextAuth.js** — authentication foundation
- **Prisma** — database client
- **PostgreSQL** — persistence database
- **Redis** — presence and active user state

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Arrow Keys | Move selected cell |
| Shift + Arrow | Extend selection |
| Enter | Begin edit / confirm edit |
| Tab | Move right / confirm edit |
| Escape | Cancel edit |
| Cmd/Ctrl + A | Select entire sheet |
| Cmd/Ctrl + C | Copy selection |
| Cmd/Ctrl + V | Paste selection |
| Cmd/Ctrl + Z | Undo |
| Cmd/Ctrl + Shift + Z | Redo |
| Cmd/Ctrl + F | Find and replace |
| Cmd/Ctrl + K | Command palette |
| Ctrl + Shift + End | Go to last used cell |

---

## 📜 Available Scripts

```bash
npm run dev              # Start local development server
npm run build            # Create production build
npm run start            # Run production server
npm run lint             # Run Next.js linting
npm run typecheck        # Run TypeScript checks
npm run prisma:generate  # Generate Prisma client
```

---

## 🌐 Deployment

### Vercel

1. Connect the GitHub repository
2. Add environment variables
3. Deploy with the default Next.js preset

### Database

Use managed PostgreSQL providers such as:

- Supabase
- Neon
- Railway
- Render
- AWS RDS

### Redis

Use managed Redis providers such as:

- Upstash
- Railway Redis
- Render Redis
- AWS ElastiCache

---

## 🛣️ Roadmap

- Multi-user persisted workbook sessions
- Full workbook database save/load
- Advanced formatting panels
- Charts and pivot-style summaries
- Formula dependency graph UI
- Protected ranges and permissions
- Comments and threaded notes
- Rich conditional formatting
- More import/export formats

---

## 🤝 Contributing

Contributions are welcome. Please open an issue or submit a pull request with a clear description of the change.

---

## 📄 License

License is currently **TBD**.

---

## ☕️ Support the Project

If Sheet by The Atom helped your workflow or inspired your next project:

- Consider buying me a coffee
- It keeps development alive and supports future updates

<div align="center">
<a href="https://buymeacoffee.com/theoneatom">
<img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" height="60" width="217">
</a>
</div>

---

<p align="center">
Made by <strong>Zaki Sheriff</strong>
</p>

<p align="center">
<em>Because spreadsheets should feel powerful, fast, and beautiful.</em>
</p>
