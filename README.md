# Contractly — generate contract DOCX files from a template

Upload a Word contract once. The app detects which company names, TINs,
bank details, dates, and signatures are unique to that contract and turns
them into a short web form. From then on, anyone can fill in the form,
click **Generate document**, and download a finished `.docx` with every
occurrence replaced — including text inside the body, tables, and
signature blocks.

The project ships pre-loaded with the real sample contract you provided
(`samples/sample-contract.docx`, the "SR TEXNO" purchase agreement) so you
can try the whole flow immediately after install.

---

## How it works (architecture)

```
┌──────────────┐   upload .docx    ┌───────────────────────┐
│   Browser    │ ───────────────▶  │ POST /api/templates/  │
│  (Next.js +  │                   │ upload                │
│ React Hook   │                   │  1. detect existing    │
│ Form + Tail- │                   │     {{tags}}, OR        │
│ wind UI)     │                   │  2. auto-tag literal    │
│              │                   │     phrases -> {{tags}} │
│              │  ◀─ field list ── │  3. save .docx + JSON  │
│              │                   │     metadata to disk    │
└──────────────┘                   └───────────────────────┘
       │
       │ fill dynamic form, click "Generate document"
       ▼
┌───────────────────────┐
│ POST /api/generate    │
│  1. load saved        │
│     template .docx     │
│  2. docxtemplater      │
│     fills {{tags}}      │
│  3. stream .docx back  │
└───────────────────────┘
       │
       ▼
   Browser downloads the finished .docx
```

Two independent problems had to be solved to make "search and replace
across an entire DOCX" actually reliable:

1. **Word silently splits one line of visible text across several XML
   `<w:r>` (run) nodes.** A naive `string.replace()` on the raw XML will
   miss text that crosses a run boundary. `src/lib/docxEngine.ts` works
   around this by reading each `<w:p>` (paragraph) as a whole, joining all
   its `<w:t>` text nodes into one string, replacing against *that*, and
   — only for paragraphs that actually changed — collapsing the paragraph
   into a single new run. Untouched paragraphs are left byte-identical, so
   original formatting elsewhere in the document is never disturbed.

2. **Identical values can legitimately appear more than once with
   different meaning.** In the sample contract, the seller's bank and the
   buyer's bank happen to share the exact same VÖEN (TIN), correspondent
   account, and SWIFT code. A plain global find-and-replace would tag
   *both* banks as "the buyer's bank" and corrupt the seller's data. The
   engine supports **table-cell-scoped rules** (`scope: { tableIndex,
   cellIndex }`) so a rule can be restricted to, e.g., "only inside the
   ALICI (buyer) column of the first table" — see
   `src/lib/defaultRules.ts` for exactly how the bank-detail fields are
   scoped, with comments explaining why.

Once a contract has been "tagged" into a reusable template (a `.docx`
that contains literal `{{field_id}}` tokens instead of the original
values), the actual fill-in-the-blanks step at generation time is handled
by the well-established **docxtemplater** + **pizzip** libraries — no
custom logic is needed there, since by that point every tag is a clean,
single-run `{{...}}` token.

---

## Project structure

```
contract-generator/
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── samples/
│   └── sample-contract.docx       # the SR TEXNO contract you provided
├── scripts/
│   └── seed-sample-template.js    # optional: pre-loads the sample via the API
├── storage/                       # local "database" (gitignored)
│   ├── templates/                 # tagged .docx templates, one per upload
│   ├── generated/                 # finished documents (recent history)
│   └── config/templates.json      # template metadata index
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx                # the 3-step wizard UI
    │   ├── globals.css
    │   └── api/
    │       ├── templates/upload/route.ts   # POST: upload + auto-tag a docx
    │       ├── templates/list/route.ts     # GET: list saved templates
    │       ├── templates/fields/route.ts   # GET: field schema for one template
    │       └── generate/route.ts           # POST: fill + download a docx
    ├── components/
    │   ├── StepIndicator.tsx
    │   ├── TemplateUploader.tsx
    │   ├── TemplateList.tsx
    │   ├── ContractForm.tsx
    │   └── DownloadPanel.tsx
    └── lib/
        ├── docxEngine.ts          # the core run-safe, scope-aware engine
        ├── defaultRules.ts        # field definitions + tagging rules
        ├── storage.ts             # filesystem-backed persistence
        └── types.ts
```

---

## Installation

Requires **Node.js 18.17+** (Node 20 LTS recommended) and npm.

```bash
# 1. Install dependencies
npm install

# 2. Run the dev server
npm run dev
```

Open **http://localhost:3000** — you'll land on the upload screen.

### Try it immediately with the bundled sample contract

With the dev server running in one terminal, run this in another:

```bash
npm run seed
```

This uploads `samples/sample-contract.docx` through the same
`/api/templates/upload` endpoint a real user would hit, so it shows up
under "saved templates" on the home page with all 11 fields already
detected. Click it, fill the form, and download a generated contract.

You can also skip the seed script entirely and just drag
`samples/sample-contract.docx` onto the upload box in the UI — the
auto-tagger runs the exact same way either path.

### Production build

```bash
npm run build
npm run start
```

---

## Using your own contract templates

Drop **any** `.docx` contract onto the upload screen. Two paths:

- **Raw contract** (literal values, no `{{...}}` tags): the auto-tagger in
  `src/lib/defaultRules.ts` looks for the specific phrases it knows about
  (the buyer company name, director, TIN, bank details, contract number,
  contract date). Only the fields it actually finds in your document
  become form fields — nothing is shown for placeholders that don't
  apply.
- **Pre-made template** (already contains `{{buyer_company}}` etc.): the
  app detects the existing tags and builds the form directly from them,
  no auto-tagging needed. This is the most reliable path for a contract
  whose layout differs a lot from the sample, since you control exactly
  where each tag goes.

To support a different *raw* contract layout out of the box, add entries
to the `defaultRules` array in `src/lib/defaultRules.ts` — each entry
needs the literal string(s) to find, the placeholder/id, and (only if the
same value can legitimately appear in more than one place with a
different meaning) a `scope` pointing at the right table cell.

---

## Notes on the storage layer

There's no external database. Templates are stored as `.docx` files in
`storage/templates/`, with a small `storage/config/templates.json` index
holding each template's detected fields. This keeps the project trivial
to run locally. `src/lib/storage.ts` is a thin, isolated module — swap
its functions for calls to Postgres, S3, or anything else without
touching any API route or component.

---

## Tech stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** for styling
- **React Hook Form** for the dynamic form
- **docxtemplater** + **pizzip** for the final placeholder-fill render
- A custom run-safe, table-cell-scope-aware XML engine
  (`src/lib/docxEngine.ts`) for the initial "tag this raw contract"
  conversion step, which docxtemplater alone cannot do reliably since it
  has no concept of "find this literal phrase wherever it appears."

## Known limitations / things to harden for a real production deployment

- **Storage** is local-disk based — fine for a single-instance deploy or
  local use, but swap in real object storage + a database before running
  multiple server instances.
- **No auth** is implemented. The brief describes a single "administrator"
  role uploading templates; add an auth check in front of
  `/api/templates/upload` before deploying this publicly.
- The auto-tagger's literal-phrase rules are calibrated to the sample
  contract's exact wording. A genuinely different contract layout is
  better served by uploading a template that already contains
  `{{placeholders}}` (see "Using your own contract templates" above),
  since literal-phrase matching can never be fully generic.
