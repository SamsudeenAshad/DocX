import { ConversionError } from './types';

/** DOCX → HTML (semantic). Uses mammoth, which preserves headings/lists/bold/tables. */
export async function docxToHtml(buf: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const { value } = await mammoth.convertToHtml({ buffer: buf });
  return value;
}

/** XLSX/XLS/CSV/ODS → array of sheets, each a 2D array of cell strings. */
export async function spreadsheetToSheets(
  buf: Buffer,
): Promise<{ name: string; rows: string[][] }[]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buf, { type: 'buffer' });
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      blankrows: false,
      defval: '',
      raw: false,
    }) as string[][];
    return { name, rows };
  });
}

/** PDF → plain text (text layer only; scanned/image PDFs yield little or nothing). */
export async function pdfToText(buf: Buffer): Promise<string> {
  // pdf-parse exports a function; default-interop for CJS.
  const mod: any = await import('pdf-parse');
  const pdfParse = mod.default ?? mod;
  try {
    const data = await pdfParse(buf);
    return (data.text ?? '').trim();
  } catch (err) {
    throw new ConversionError(
      'Failed to read PDF. It may be encrypted or contain no extractable text layer (scanned image).',
      err,
    );
  }
}

/** HTML → plain text. */
export async function htmlToText(html: string): Promise<string> {
  const { convert } = await import('html-to-text');
  return convert(html, { wordwrap: false }).trim();
}
