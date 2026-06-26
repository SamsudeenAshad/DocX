import PDFDocument from 'pdfkit';
import { Block, Inline, htmlToBlocks } from './html-model';
import { ConversionError } from './types';

const HEADING_PT = [22, 18, 15, 13, 12, 11];
const BODY_PT = 11;
const PAGE_MARGIN = 50;

// ---------------------------------------------------------------------------
// PDF (pdfkit) — pure JS, uses PDF's built-in standard fonts, no browser/soffice.
// ---------------------------------------------------------------------------

function fontFor(i: Inline, mono = false): string {
  if (mono || i.code) {
    return i.bold ? 'Courier-Bold' : i.italic ? 'Courier-Oblique' : 'Courier';
  }
  if (i.bold && i.italic) return 'Helvetica-BoldOblique';
  if (i.bold) return 'Helvetica-Bold';
  if (i.italic) return 'Helvetica-Oblique';
  return 'Helvetica';
}

/** Write a run of inline fragments as a single flowing paragraph. */
function writeInlines(doc: any, inlines: Inline[], size: number) {
  if (!inlines.length) {
    doc.font('Helvetica').fontSize(size).text(' ');
    return;
  }
  inlines.forEach((frag, idx) => {
    doc.font(fontFor(frag)).fontSize(size);
    doc.text(frag.text, { continued: idx < inlines.length - 1 });
  });
}

function renderBlocks(doc: any, blocks: Block[]) {
  blocks.forEach((b) => {
    switch (b.type) {
      case 'heading':
        doc.moveDown(0.4);
        doc.font('Helvetica-Bold').fontSize(HEADING_PT[b.level - 1] ?? BODY_PT);
        doc.text(b.inlines.map((i) => i.text).join(''));
        doc.moveDown(0.3);
        break;
      case 'paragraph':
        writeInlines(doc, b.inlines, BODY_PT);
        doc.moveDown(0.5);
        break;
      case 'list':
        b.items.forEach((it, n) => {
          const bullet = b.ordered ? `${n + 1}. ` : '•  ';
          doc.font('Helvetica').fontSize(BODY_PT);
          doc.text(bullet, { continued: true });
          writeInlines(doc, it, BODY_PT);
        });
        doc.moveDown(0.5);
        break;
      case 'code':
        doc.font('Courier').fontSize(9).fillColor('#333333');
        doc.text(b.text, { lineGap: 1 });
        doc.fillColor('#000000');
        doc.moveDown(0.5);
        break;
      case 'quote':
        doc.font('Helvetica-Oblique').fontSize(BODY_PT).fillColor('#555555');
        doc.text(b.inlines.map((i) => i.text).join(''), { indent: 18 });
        doc.fillColor('#000000');
        doc.moveDown(0.5);
        break;
      case 'hr':
        doc.moveDown(0.3);
        doc
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .strokeColor('#cccccc')
          .stroke();
        doc.moveDown(0.5);
        break;
      case 'table':
        renderTable(doc, b.rows);
        doc.moveDown(0.5);
        break;
    }
  });
}

/** Simple fixed-grid table: equal column widths, header row in bold. */
function renderTable(doc: any, rows: Inline[][][]) {
  if (!rows.length) return;
  const cols = Math.max(...rows.map((r) => r.length));
  const left = doc.page.margins.left;
  const usable = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colW = usable / cols;
  const pad = 4;

  rows.forEach((row, ri) => {
    const cellTexts = Array.from({ length: cols }, (_, ci) =>
      (row[ci] ?? []).map((i) => i.text).join(''),
    );
    doc.font(ri === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
    const heights = cellTexts.map((t) => doc.heightOfString(t || ' ', { width: colW - pad * 2 }));
    const rowH = Math.max(...heights) + pad * 2;

    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const y = doc.y;

    cellTexts.forEach((t, ci) => {
      const x = left + ci * colW;
      doc.rect(x, y, colW, rowH).strokeColor('#999999').lineWidth(0.5).stroke();
      doc.fillColor('#000000').text(t, x + pad, y + pad, { width: colW - pad * 2 });
    });
    doc.y = y + rowH;
  });
}

function blocksToPdf(blocks: Block[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: PAGE_MARGIN, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.font('Helvetica').fontSize(BODY_PT);
      renderBlocks(doc, blocks.length ? blocks : [{ type: 'paragraph', inlines: [{ text: '' }] }]);
      doc.end();
    } catch (err) {
      reject(new ConversionError('PDF generation failed', err));
    }
  });
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
