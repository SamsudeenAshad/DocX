import { Block, Inline, htmlToBlocks } from './html-model';
import { ConversionError } from './types';

const HEADING_PT = [22, 18, 15, 13, 12, 11];

// ---------------------------------------------------------------------------
// PDF (pdfmake) — pure JS, embeds its own fonts, no browser/soffice needed.
// ---------------------------------------------------------------------------

function inlinesToPdf(inlines: Inline[]): any[] {
  return inlines.map((i) => ({
    text: i.text,
    bold: i.bold || undefined,
    italics: i.italic || undefined,
    ...(i.code ? { font: 'Courier' } : {}),
  }));
}

function blocksToPdfContent(blocks: Block[]): any[] {
  const content: any[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'heading':
        content.push({
          text: inlinesToPdf(b.inlines),
          fontSize: HEADING_PT[b.level - 1] ?? 11,
          bold: true,
          margin: [0, 8, 0, 4],
        });
        break;
      case 'paragraph':
        content.push({ text: inlinesToPdf(b.inlines), margin: [0, 0, 0, 6] });
        break;
      case 'list':
        content.push({
          [b.ordered ? 'ol' : 'ul']: b.items.map((it) => ({ text: inlinesToPdf(it) })),
          margin: [0, 0, 0, 6],
        });
        break;
      case 'code':
        content.push({
          text: b.text,
          font: 'Courier',
          fontSize: 9,
          fillColor: '#f4f4f4',
          margin: [0, 0, 0, 6],
        });
        break;
      case 'quote':
        content.push({
          text: inlinesToPdf(b.inlines),
          italics: true,
          color: '#555555',
          margin: [12, 0, 0, 6],
        });
        break;
      case 'hr':
        content.push({
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }],
          margin: [0, 4, 0, 8],
        });
        break;
      case 'table': {
        if (!b.rows.length) break;
        const width = Math.max(...b.rows.map((r) => r.length));
        const body = b.rows.map((r) => {
          const cells = r.map((c) => ({ text: inlinesToPdf(c) }));
          while (cells.length < width) cells.push({ text: [] });
          return cells;
        });
        content.push({
          table: { headerRows: 1, widths: Array(width).fill('*'), body },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 8],
        });
        break;
      }
    }
  }
  return content.length ? content : [{ text: '' }];
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  return blocksToPdf(htmlToBlocks(html));
}

export async function rowsToPdf(sheets: { name: string; rows: string[][] }[]): Promise<Buffer> {
  const blocks: Block[] = [];
  for (const sheet of sheets) {
    if (sheets.length > 1) {
      blocks.push({ type: 'heading', level: 2, inlines: [{ text: sheet.name }] });
    }
    if (sheet.rows.length) {
      blocks.push({ type: 'table', rows: sheet.rows.map((r) => r.map((c) => [{ text: c ?? '' }])) });
    }
  }
  return blocksToPdf(blocks);
}

function blocksToPdf(blocks: Block[]): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      // The Node server-side printer lives at pdfmake/src/printer; the package
      // root + @types/pdfmake describe the browser client which has no constructor
      // and ships no types for this subpath. Load it via runtime require to bypass
      // TS module resolution.
      const req = eval('require') as NodeRequire;
      const PdfPrinter: any = req('pdfmake/src/printer');
      const printer = new PdfPrinter(STANDARD_FONTS);
      const doc = printer.createPdfKitDocument({
        content: blocksToPdfContent(blocks),
        defaultStyle: { font: 'Helvetica', fontSize: 11, lineHeight: 1.3 },
        pageMargins: [40, 40, 40, 40],
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    } catch (err) {
      reject(new ConversionError('PDF generation failed', err));
    }
  });
}

// pdfmake needs font descriptors; PDF's 14 standard fonts need no embedding.
const STANDARD_FONTS = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
  Courier: {
    normal: 'Courier',
    bold: 'Courier-Bold',
    italics: 'Courier-Oblique',
    bolditalics: 'Courier-BoldOblique',
  },
};

// ---------------------------------------------------------------------------
// DOCX (docx lib)
// ---------------------------------------------------------------------------

export async function blocksToDocx(blocks: Block[]): Promise<Buffer> {
  const d = await import('docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } = d;

  const runs = (inlines: Inline[]) =>
    inlines.map(
      (i) =>
        new TextRun({
          text: i.text,
          bold: i.bold,
          italics: i.italic,
          font: i.code ? 'Courier New' : undefined,
        }),
    );

  const HEADINGS = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ];

  const children: any[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case 'heading':
        children.push(new Paragraph({ heading: HEADINGS[b.level - 1] ?? HEADINGS[5], children: runs(b.inlines) }));
        break;
      case 'paragraph':
        children.push(new Paragraph({ children: runs(b.inlines) }));
        break;
      case 'list':
        b.items.forEach((it) =>
          children.push(
            new Paragraph({
              children: runs(it),
              bullet: b.ordered ? undefined : { level: 0 },
              numbering: undefined,
            }),
          ),
        );
        break;
      case 'code':
        b.text.split('\n').forEach((line) =>
          children.push(new Paragraph({ children: [new TextRun({ text: line, font: 'Courier New' })] })),
        );
        break;
      case 'quote':
        children.push(new Paragraph({ children: runs(b.inlines), indent: { left: 360 } }));
        break;
      case 'hr':
        children.push(new Paragraph({ text: '' }));
        break;
      case 'table': {
        if (!b.rows.length) break;
        const width = Math.max(...b.rows.map((r) => r.length));
        const rows = b.rows.map(
          (r) =>
            new TableRow({
              children: Array.from({ length: width }, (_, i) =>
                new TableCell({ children: [new Paragraph({ children: runs(r[i] ?? []) })] }),
              ),
            }),
        );
        children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        break;
      }
    }
  }

  const doc = new Document({ sections: [{ children: children.length ? children : [new Paragraph({ text: '' })] }] });
  return Packer.toBuffer(doc);
}

export async function htmlToDocx(html: string): Promise<Buffer> {
  return blocksToDocx(htmlToBlocks(html));
}

// ---------------------------------------------------------------------------
// XLSX / CSV
// ---------------------------------------------------------------------------

export async function sheetsToXlsx(sheets: { name: string; rows: string[][] }[]): Promise<Buffer> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const list = sheets.length ? sheets : [{ name: 'Sheet1', rows: [[]] }];
  list.forEach((s, i) => {
    const ws = XLSX.utils.aoa_to_sheet(s.rows.length ? s.rows : [['']]);
    XLSX.utils.book_append_sheet(wb, ws, (s.name || `Sheet${i + 1}`).slice(0, 31));
  });
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export function sheetsToCsv(sheets: { name: string; rows: string[][] }[]): string {
  // First sheet only for CSV (single-table format).
  const rows = sheets[0]?.rows ?? [];
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

function csvCell(v: string): string {
  const s = v ?? '';
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function sheetsToMarkdown(sheets: { name: string; rows: string[][] }[]): string {
  const parts: string[] = [];
  for (const s of sheets) {
    if (sheets.length > 1) parts.push(`## ${s.name}\n`);
    if (!s.rows.length) continue;
    const width = Math.max(...s.rows.map((r) => r.length));
    const pad = (r: string[]) => Array.from({ length: width }, (_, i) => mdCell(r[i] ?? ''));
    const [head, ...body] = s.rows;
    parts.push('| ' + pad(head).join(' | ') + ' |');
    parts.push('| ' + Array(width).fill('---').join(' | ') + ' |');
    body.forEach((r) => parts.push('| ' + pad(r).join(' | ') + ' |'));
    parts.push('');
  }
  return parts.join('\n').trim() + '\n';
}

function mdCell(v: string): string {
  return (v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function sheetsToHtml(sheets: { name: string; rows: string[][] }[]): string {
  const tables = sheets
    .map((s) => {
      const rows = s.rows
        .map(
          (r, ri) =>
            '<tr>' +
            r.map((c) => `<${ri === 0 ? 'th' : 'td'}>${escapeHtml(c ?? '')}</${ri === 0 ? 'th' : 'td'}>`).join('') +
            '</tr>',
        )
        .join('');
      const title = sheets.length > 1 ? `<h2>${escapeHtml(s.name)}</h2>` : '';
      return `${title}<table border="1" cellspacing="0" cellpadding="4">${rows}</table>`;
    })
    .join('\n');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${tables}</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
