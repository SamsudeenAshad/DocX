import { Format } from './types';

const EXT_TO_FORMAT: Record<string, Format> = {
  docx: 'docx',
  doc: 'docx',
  xlsx: 'xlsx',
  xls: 'xlsx',
  md: 'md',
  markdown: 'md',
  pdf: 'pdf',
  html: 'html',
  htm: 'html',
  txt: 'txt',
  csv: 'csv',
  odt: 'odt',
  ods: 'ods',
};

export const MIME: Record<Format, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  md: 'text/markdown',
  pdf: 'application/pdf',
  html: 'text/html',
  txt: 'text/plain',
  csv: 'text/csv',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
};

/** Derive a Format from a filename's extension. */
export function formatFromFilename(filename?: string): Format | undefined {
  if (!filename) return undefined;
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? EXT_TO_FORMAT[ext] : undefined;
}

/** Sniff a format from leading magic bytes (best effort). */
export function formatFromMagic(buf: Buffer): Format | undefined {
  if (buf.length >= 4) {
    // PDF: "%PDF"
    if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'pdf';
    // ZIP container (docx/xlsx/odt/ods all are zip): "PK\x03\x04"
    if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
      const head = buf.toString('latin1', 0, Math.min(buf.length, 4000));
      if (head.includes('word/')) return 'docx';
      if (head.includes('xl/')) return 'xlsx';
      // can't tell zip subtype reliably from head alone; leave undefined
    }
  }
  return undefined;
}

/** Resolve the effective source format from explicit value, filename, then bytes. */
export function detectFormat(
  buf: Buffer,
  explicit?: Format,
  filename?: string,
): Format | undefined {
  return explicit ?? formatFromFilename(filename) ?? formatFromMagic(buf);
}

/** LibreOffice filter map: target format -> soffice --convert-to argument. */
export const LO_FILTER: Partial<Record<Format, string>> = {
  pdf: 'pdf',
  docx: 'docx:MS Word 2007 XML',
  xlsx: 'xlsx:Calc MS Excel 2007 XML',
  html: 'html',
  txt: 'txt:Text',
  csv: 'csv',
  odt: 'odt',
  ods: 'ods',
};
