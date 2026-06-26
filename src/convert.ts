import { ConversionError, ConvertOptions, ConvertResult, Format } from './types';
import { detectFormat, MIME } from './formats';
import { markdownToHtml, htmlToMarkdown } from './markdown';
import { docxToHtml, spreadsheetToSheets, pdfToText, htmlToText } from './readers';
import {
  htmlToPdf,
  htmlToDocx,
  rowsToPdf,
  sheetsToXlsx,
  sheetsToCsv,
  sheetsToMarkdown,
  sheetsToHtml,
} from './writers';

const SPREADSHEET: Format[] = ['xlsx', 'ods', 'csv'];
const DOC: Format[] = ['docx', 'odt', 'md', 'html'];

/**
 * Convert a document between formats — pure JS, no system dependencies.
 *
 * Strategy: read the source into a normal form, then render to the target.
 *  - spreadsheets (xlsx/ods/csv) → sheet rows → xlsx | csv | md | html | pdf
 *  - documents   (docx/md/html)  → HTML       → pdf | docx | md | html | txt
 *  - pdf                          → text       → txt | md (best effort)
 */
export async function convert(
  input: Buffer | string,
  opts: ConvertOptions,
): Promise<ConvertResult> {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  const to = opts.to;
  const from = detectFormat(buf, opts.from, opts.filename);

  if (!from) {
    throw new ConversionError(
      'Could not determine the source format. Pass `from` explicitly or provide a filename with an extension.',
    );
  }
  if (from === to) return result(buf, to);

  // --- Spreadsheet sources --------------------------------------------------
  if (SPREADSHEET.includes(from)) {
    const sheets = await spreadsheetToSheets(buf);
    switch (to) {
      case 'xlsx':
        return result(await sheetsToXlsx(sheets), 'xlsx');
      case 'ods':
        return result(await sheetsToXlsx(sheets), 'xlsx'); // emit xlsx; ODS write not supported
      case 'csv':
        return result(Buffer.from(sheetsToCsv(sheets), 'utf8'), 'csv');
      case 'md':
        return result(Buffer.from(sheetsToMarkdown(sheets), 'utf8'), 'md');
      case 'html':
        return result(Buffer.from(sheetsToHtml(sheets), 'utf8'), 'html');
      case 'txt':
        return result(Buffer.from(sheetsToCsv(sheets), 'utf8'), 'txt');
      case 'pdf':
        return result(await rowsToPdf(sheets), 'pdf');
      case 'docx':
        throw unsupported(from, to, 'Convert the spreadsheet to xlsx/csv instead.');
      default:
        throw unsupported(from, to);
    }
  }

  // --- PDF source (text extraction only) -----------------------------------
  if (from === 'pdf') {
    const text = await pdfToText(buf);
    switch (to) {
      case 'txt':
        return result(Buffer.from(text + '\n', 'utf8'), 'txt');
      case 'md':
        return result(Buffer.from(textToMarkdown(text), 'utf8'), 'md');
      case 'docx':
        return result(await htmlToDocx(textToHtml(text)), 'docx');
      case 'html':
        return result(Buffer.from(textToHtml(text), 'utf8'), 'html');
      case 'xlsx': {
        const rows = text.split('\n').map((line) => line.split(/\t|\s{2,}/));
        return result(await sheetsToXlsx([{ name: 'Sheet1', rows }]), 'xlsx');
      }
      case 'csv': {
        const rows = text.split('\n').map((line) => line.split(/\t|\s{2,}/));
        return result(Buffer.from(sheetsToCsv([{ name: 'Sheet1', rows }]), 'utf8'), 'csv');
      }
      default:
        throw unsupported(from, to);
    }
  }

  // --- Document sources: normalize to HTML ---------------------------------
  if (DOC.includes(from)) {
    let html: string;
    if (from === 'md') html = markdownToHtml(buf.toString('utf8'));
    else if (from === 'html') html = buf.toString('utf8');
    else if (from === 'docx' || from === 'odt') html = await docxToHtml(buf);
    else throw unsupported(from, to);

    switch (to) {
      case 'html':
        return result(Buffer.from(html, 'utf8'), 'html');
      case 'pdf':
        return result(await htmlToPdf(html), 'pdf');
      case 'docx':
        return result(await htmlToDocx(html), 'docx');
      case 'md':
        return result(Buffer.from(htmlToMarkdown(html), 'utf8'), 'md');
      case 'txt':
        return result(Buffer.from((await htmlToText(html)) + '\n', 'utf8'), 'txt');
      case 'xlsx':
      case 'csv':
        throw unsupported(from, to, 'Documents have no tabular structure to map to a spreadsheet.');
      default:
        throw unsupported(from, to);
    }
  }

  throw unsupported(from, to);
}

function textToHtml(text: string): string {
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${paras}</body></html>`;
}

function textToMarkdown(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function result(data: Buffer, ext: Format): ConvertResult {
  return { data, mime: MIME[ext] ?? 'application/octet-stream', ext };
}

function unsupported(from: Format, to: Format, hint?: string): ConversionError {
  return new ConversionError(`Conversion not supported: ${from} → ${to}.${hint ? ' ' + hint : ''}`);
}
