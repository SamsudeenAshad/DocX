import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ConversionError, Format } from './types';
import { LO_FILTER } from './formats';

const CANDIDATE_PATHS = [
  process.env.SOFFICE_PATH,
  'soffice',
  'libreoffice',
  '/Applications/LibreOffice.app/Contents/MacOS/soffice',
  '/usr/bin/soffice',
  '/usr/bin/libreoffice',
  '/usr/local/bin/soffice',
  '/opt/libreoffice/program/soffice',
  'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
].filter(Boolean) as string[];

let cachedBinary: string | undefined;

function tryExec(bin: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(bin, ['--version'], { timeout: 15_000 }, (err) => resolve(!err));
  });
}

/** Resolve a working LibreOffice binary, caching the result. */
export async function resolveSoffice(override?: string): Promise<string> {
  if (override) {
    if (await tryExec(override)) return override;
    throw new ConversionError(`LibreOffice binary not runnable at: ${override}`);
  }
  if (cachedBinary) return cachedBinary;

  for (const candidate of CANDIDATE_PATHS) {
    if (await tryExec(candidate)) {
      cachedBinary = candidate;
      return candidate;
    }
  }
  throw new ConversionError(
    'LibreOffice not found. Install it (e.g. `brew install --cask libreoffice`, ' +
      '`apt-get install libreoffice`) or set the SOFFICE_PATH environment variable ' +
      'to the soffice binary.',
  );
}

/**
 * Convert a single file to `target` format using LibreOffice headless.
 * Runs in an isolated temp dir + user profile so concurrent calls don't collide.
 */
export async function libreofficeConvert(
  input: Buffer,
  inputExt: string,
  target: Format,
  opts: { sofficePath?: string; timeoutMs?: number } = {},
): Promise<Buffer> {
  const filter = LO_FILTER[target];
  if (!filter) {
    throw new ConversionError(`LibreOffice cannot produce target format: ${target}`);
  }

  const bin = await resolveSoffice(opts.sofficePath);
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'docx-lo-'));
  const profile = path.join(work, 'profile');
  const inputFile = path.join(work, `input.${inputExt}`);

  try {
    await fs.writeFile(inputFile, input);

    const args = [
      '--headless',
      '--norestore',
      '--nolockcheck',
      '--nodefault',
      `-env:UserInstallation=file://${profile}`,
      '--convert-to',
      filter,
      '--outdir',
      work,
      inputFile,
    ];

    await runSoffice(bin, args, opts.timeoutMs ?? 120_000);

    // LibreOffice names output after the input basename + new extension.
    const outName = `input.${target}`;
    const outPath = path.join(work, outName);
    try {
      return await fs.readFile(outPath);
    } catch {
      // Fallback: pick the produced file that isn't the input.
      const files = await fs.readdir(work);
      const produced = files.find(
        (f) => f !== `input.${inputExt}` && f !== 'profile' && f.endsWith(`.${target}`),
      );
      if (!produced) {
        throw new ConversionError(
          `LibreOffice did not produce a .${target} file (got: ${files.join(', ')}). ` +
            `Conversion ${inputExt} → ${target} may be unsupported.`,
        );
      }
      return await fs.readFile(path.join(work, produced));
    }
  } finally {
    await fs.rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}

function runSoffice(bin: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) {
        reject(
          new ConversionError(
            `LibreOffice conversion failed: ${stderr?.toString().trim() || err.message}`,
            err,
          ),
        );
      } else {
        resolve();
      }
    });
  });
}
