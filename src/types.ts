/** Supported document formats. */
export type Format = 'docx' | 'xlsx' | 'md' | 'pdf' | 'html' | 'txt' | 'csv' | 'odt' | 'ods';

export interface ConvertOptions {
  /** Source format. Auto-detected from filename/magic bytes if omitted. */
  from?: Format;
  /** Target format. Required. */
  to: Format;
  /** Original filename — used for format auto-detection when `from` is absent. */
  filename?: string;
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
