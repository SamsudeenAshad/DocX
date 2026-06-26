# n8n-nodes-docx

Convert documents between **Word (DOCX)**, **Excel (XLSX)**, **Markdown (MD)**, **PDF**, HTML and plain text — as an [n8n](https://n8n.io) community node, and as a reusable Node.js library.

High-fidelity Office ↔ PDF conversion is powered by **LibreOffice headless**; Markdown is handled in pure JS.

## Conversion matrix

| From \ To | PDF | DOCX | XLSX | MD  | HTML | TXT |
|-----------|:---:|:----:|:----:|:---:|:----:|:---:|
| **DOCX**  | ✅  |  —   |  —   | ✅  | ✅   | ✅  |
| **XLSX**  | ✅  |  —   |  —   | ✅  | ✅   | ✅  |
| **MD**    | ✅  | ✅   |  —   |  —  | ✅   | —   |
| **PDF**   |  —  | ✅   | ✅   | ⚠️  | ⚠️   | ✅  |
| **HTML**  | ✅  | ✅   |  —   | ✅  |  —   | ✅  |

✅ supported · ⚠️ best-effort (depends on the PDF's text layer) · — not meaningful

## Requirements

- **Node.js ≥ 18.10**
- **LibreOffice** for any conversion involving DOCX / XLSX / PDF.
  - macOS: `brew install --cask libreoffice`
  - Debian/Ubuntu: `sudo apt-get install -y libreoffice`
  - Docker n8n: install LibreOffice in your image, or set `SOFFICE_PATH`.

The binary is auto-detected. Override with the `SOFFICE_PATH` env var or the node's **LibreOffice Path** option. Markdown↔HTML works without LibreOffice.

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
  from?: 'docx'|'xlsx'|'md'|'pdf'|'html'|'txt'|'csv'|'odt'|'ods'; // auto-detected if omitted
  to:    'docx'|'xlsx'|'md'|'pdf'|'html'|'txt'|'csv'|'odt'|'ods';
  filename?: string;     // helps auto-detection
  sofficePath?: string;  // override LibreOffice binary
  timeoutMs?: number;    // default 120000
}): Promise<{ data: Buffer; mime: string; ext: Format }>
```

## Development

```bash
npm install
npm run build      # tsc → dist/
npm test           # node --test (JS-only paths; no LibreOffice required)
npm run dev        # tsc --watch
```

Project layout:

```
src/                 reusable conversion library
  convert.ts         routing / orchestration
  libreoffice.ts     soffice headless wrapper
  markdown.ts        md ↔ html
  formats.ts         detection + MIME + LO filters
nodes/Docx/          n8n community node + icon
test/                smoke tests
```

## License

MIT
