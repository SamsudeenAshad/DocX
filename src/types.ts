/** Supported document formats. */
export type Format = 'docx' | 'xlsx' | 'md' | 'pdf' | 'html' | 'txt' | 'csv' | 'odt' | 'ods';

export interface ConvertOptions {
  /** Source format. Auto-detected from filename/magic bytes if omitted. */
  from?: Format;
  /** Target format. Required. */
  to: Format;
  /** Original filename — used for format auto-detection when `from` is absent. */
  filename?: string;
  /** Override the LibreOffice binary path (otherwise auto-resolved / $SOFFICE_PATH). */
  sofficePath?: string;
  /** Max time a single conversion may run, ms. Default 120_000. */
  timeoutMs?: number;
}

export interface ConvertResult {
  /** Converted document bytes. */
  data: Buffer;
  /** MIME type of the output. */
  mime: string;
  /** File extension of the output, without the leading dot. */
  ext: Format;
}

export class ConversionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ConversionError';
  }
}
