# n8n-nodes-docx

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

## Install (n8n)

In n8n: **Settings → Community Nodes → Install**, enter `n8n-nodes-docx`.

Or manually:

```bash
cd ~/.n8n/nodes        # or your N8N_CUSTOM_EXTENSIONS dir
npm install n8n-nodes-docx
```

Add a **DocX Convert** node, pick **Source Format** (or Auto-Detect) and **Target Format**, and point it at the binary property holding your file (default `data`).

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
