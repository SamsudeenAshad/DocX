import { ConversionError, ConvertOptions, ConvertResult, Format } from './types';
import { detectFormat, MIME } from './formats';
import { libreofficeConvert } from './libreoffice';
import { htmlToMarkdown, markdownToHtml } from './markdown';

/**
 * Convert a document between formats.
 *
 * Routing:
 *  - md  → html        : marked (pure JS)
 *  - html→ md          : turndown (pure JS)
 *  - md  → pdf|docx    : md → html → LibreOffice
 *  - office/pdf → md   : LibreOffice → html → turndown
 *  - everything else   : LibreOffice direct
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

  if (from === to) {
    return result(buf, to);
  }

  const loOpts = { sofficePath: opts.sofficePath, timeoutMs: opts.timeoutMs };

  // --- Markdown source ---------------------------------------------------
  if (from === 'md') {
    const html = markdownToHtml(buf.toString('utf8'));
    if (to === 'html') return result(Buffer.from(html, 'utf8'), 'html');
    if (to === 'pdf' || to === 'docx' || to === 'odt') {
      const out = await libreofficeConvert(Buffer.from(html, 'utf8'), 'html', to, loOpts);
      return result(out, to);
    }
    throw unsupported(from, to);
  }

  // --- Markdown target ---------------------------------------------------
  if (to === 'md') {
    if (from === 'html') return result(Buffer.from(htmlToMarkdown(buf.toString('utf8')), 'utf8'), 'md');
    // office/pdf → html (LibreOffice) → md (turndown)
    const html = await libreofficeConvert(buf, from, 'html', loOpts);
    return result(Buffer.from(htmlToMarkdown(html.toString('utf8')), 'utf8'), 'md');
  }

  // --- Everything else: let LibreOffice handle it directly ---------------
  const out = await libreofficeConvert(buf, from, to, loOpts);
  return result(out, to);
}

function result(data: Buffer, ext: Format): ConvertResult {
  return { data, mime: MIME[ext] ?? 'application/octet-stream', ext };
}

function unsupported(from: Format, to: Format): ConversionError {
  return new ConversionError(`Conversion not supported: ${from} → ${to}`);
}
