# n8n-nodes-docx

[![npm version](https://img.shields.io/npm/v/n8n-nodes-docx.svg)](https://www.npmjs.com/package/n8n-nodes-docx)
[![npm downloads](https://img.shields.io/npm/dm/n8n-nodes-docx.svg)](https://www.npmjs.com/package/n8n-nodes-docx)
[![n8n community node](https://img.shields.io/badge/n8n-community%20node-FF6D5A)](https://www.npmjs.com/package/n8n-nodes-docx)
[![license](https://img.shields.io/npm/l/n8n-nodes-docx.svg)](./LICENSE)

Convert documents between **Word (DOCX)**, **Excel (XLSX)**, **Markdown (MD)**, **PDF**, HTML, CSV and plain text — as an [n8n](https://n8n.io) community node, and as a reusable Node.js library.

**100% pure JavaScript — no LibreOffice, no system binaries, no setup.** Works on any n8n instance (including managed/Docker hosts) the moment you install it.

## Conversion matrix

| From \ To | PDF | DOCX | XLSX | CSV | MD  | HTML | TXT |
|-----------|:---:|:----:|:----:|:---:|:---:|:----:|:---:|
| **DOCX**  | ✅  |  —   |  —   |  —  | ✅  | ✅   | ✅  |
| **XLSX**  | ✅  |  —   | ✅   | ✅  | ✅  | ✅   | ✅  |
| **CSV**   | ✅  |  —   | ✅   |  —  | ✅  | ✅   | ✅  |
| **MD**    | ✅  | ✅   |  —   |  —  |  —  | ✅   | ✅  |
| **HTML**  | ✅  | ✅   |  —   |  —  | ✅  |  —   | ✅  |
| **PDF**   |  —  | ⚠️   | ⚠️   | ⚠️  | ⚠️  | ⚠️   | ✅  |

✅ supported · ⚠️ best-effort (text-layer extraction; layout/images not preserved) · — not meaningful

### Fidelity notes

Pure-JS conversion favours **content and structure** (text, headings, lists, tables, bold/italic) over pixel-perfect layout. Complex page layouts, embedded fonts and images are simplified. For most Word/Excel/Markdown/PDF automation this is exactly what you want; if you need print-perfect fidelity, a LibreOffice-backed service is the alternative.

## Requirements

- **Node.js ≥ 18.10**

That's it. All conversion libraries ship inside the package.

## Use in n8n (community node)

This package is published on npm as an [n8n community node](https://docs.n8n.io/integrations/community-nodes/):

> **[`n8n-nodes-docx`](https://www.npmjs.com/package/n8n-nodes-docx)** — `v0.2.0` · Public · built-in TypeScript declarations
> `npm i n8n-nodes-docx`

It adds a single node — **DocX Convert** — that converts a binary file from one document format to another. No LibreOffice or other system package is required; everything ships inside the node.

### Install

**Via the n8n UI (recommended):**

1. Open **Settings → Community Nodes → Install**.
2. Enter the npm package name `n8n-nodes-docx` and confirm.
3. The **DocX Convert** node appears in the node panel (search "DocX").

> Self-hosted only. The Community Nodes panel is available on self-hosted n8n; on n8n Cloud, community nodes must be enabled by the workspace.

**Manually (self-hosted / Docker):**

```bash
# inside your n8n data dir (mounts to /home/node/.n8n in Docker)
cd ~/.n8n/nodes
npm install n8n-nodes-docx
# restart n8n
```

### The DocX Convert node

| Field | Description | Default |
|-------|-------------|---------|
| **Source Format** | Format of the incoming file, or **Auto-Detect** (uses filename + file signature). | Auto-Detect |
| **Target Format** | Format to convert to: PDF, DOCX, XLSX, CSV, MD, HTML, TXT. | PDF |
| **Input Binary Property** | Binary property on the item holding the source file. | `data` |
| **Output Binary Property** | Binary property to write the converted file to. | `data` |
| **Options → Output File Name** | Base name (no extension) for the result. Falls back to the input file name. | input name |

**Output:** the converted file is attached as binary on the output property, and the item's JSON gains `fileName`, `mimeType`, `size`, `from`, and `to`. Enable **Continue On Fail** to route conversion errors as data instead of stopping the workflow.

### Example workflows

**1. Convert an uploaded Word doc to PDF**

```
Webhook (file upload)
  └─ DocX Convert   (Source: Auto-Detect, Target: PDF)
       └─ Respond to Webhook / Write Binary File
```

**2. Pull an Excel attachment from email and turn it into Markdown for an LLM**

```
Email Trigger (IMAP)        → binary `attachment_0`
  └─ DocX Convert            (Source: Excel, Target: Markdown,
                              Input Binary Property: attachment_0)
       └─ AI Agent / Set     (use the markdown table downstream)
```

**3. Batch: convert every Markdown file in a folder to DOCX**

```
Read/List Files (Binary)
  └─ DocX Convert   (Source: Markdown, Target: Word (DOCX))
       └─ Write Binary File
```

## Use as a library

```ts
import { convert } from 'n8n-nodes-docx';
import { readFile, writeFile } from 'node:fs/promises';

const docx = await readFile('report.docx');
const { data, ext, mime } = await convert(docx, { from: 'docx', to: 'pdf' });
await writeFile(`report.${ext}`, data);

// Markdown → Word
const pdf = await convert('# Hello\n\nWorld', { from: 'md', to: 'docx' });

// Auto-detect from filename
await convert(buf, { to: 'md', filename: 'sheet.xlsx' });
```

### API

```ts
convert(input: Buffer | string, opts: {
  from?: 'docx'|'xlsx'|'md'|'pdf'|'html'|'txt'|'csv'; // auto-detected if omitted
  to:    'docx'|'xlsx'|'md'|'pdf'|'html'|'txt'|'csv';
  filename?: string;     // helps auto-detection
}): Promise<{ data: Buffer; mime: string; ext: Format }>
```

## Development

```bash
npm install
npm run build      # tsc → dist/
npm test           # node --test (real conversions, no system deps)
npm run dev        # tsc --watch
```

Project layout:

```
src/                 reusable conversion library
  convert.ts         routing / orchestration
  readers.ts         docx/xlsx/pdf/html → normalized form
  writers.ts         → pdf (pdfkit), docx, xlsx, csv, md, html
  html-model.ts      HTML → structured blocks (shared by pdf/docx writers)
  markdown.ts        md ↔ html (marked / turndown)
  formats.ts         format detection + MIME
nodes/Docx/          n8n community node + icon
test/                conversion tests
```

Powered by: `pdfkit`, `docx`, `xlsx` (SheetJS), `mammoth`, `pdf-parse`, `marked`, `turndown`, `html-to-text` — all pure JS.

## License

MIT
