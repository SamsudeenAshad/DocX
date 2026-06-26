/**
 * Minimal HTML → structured-block parser shared by the PDF and DOCX writers.
 * Not a full HTML engine — handles the subset emitted by `marked` and `mammoth`:
 * headings, paragraphs, lists, tables, bold/italic, code, blockquotes, hr.
 */

export type Inline = { text: string; bold?: boolean; italic?: boolean; code?: boolean };

export type Block =
  | { type: 'heading'; level: number; inlines: Inline[] }
  | { type: 'paragraph'; inlines: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'code'; text: string }
  | { type: 'quote'; inlines: Inline[] }
  | { type: 'table'; rows: Inline[][][] }
  | { type: 'hr' };

interface Node {
  tag: string;
  attrs: string;
  children: (Node | string)[];
}

const VOID = new Set(['br', 'hr', 'img', 'meta', 'link', 'input', 'col']);

/** Tiny tolerant HTML tokenizer/parser producing a node tree. */
function parse(html: string): Node {
  const root: Node = { tag: 'root', attrs: '', children: [] };
  const stack: Node[] = [root];
  const re = /<(\/?)([a-zA-Z0-9]+)([^>]*?)(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, closing, rawTag, attrs, selfClose, text] = m;
    if (text !== undefined) {
      const decoded = decode(text);
      if (decoded) stack[stack.length - 1].children.push(decoded);
      continue;
    }
    const tag = rawTag.toLowerCase();
    if (closing) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
    } else {
      const node: Node = { tag, attrs, children: [] };
      stack[stack.length - 1].children.push(node);
      if (!selfClose && !VOID.has(tag)) stack.push(node);
    }
  }
  return root;
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function collectInlines(node: Node | string, ctx: Partial<Inline> = {}): Inline[] {
  if (typeof node === 'string') {
    return node.trim() === '' && node.indexOf('\n') >= 0 ? [] : [{ text: node, ...ctx }];
  }
  const next = { ...ctx };
  if (node.tag === 'b' || node.tag === 'strong') next.bold = true;
  if (node.tag === 'i' || node.tag === 'em') next.italic = true;
  if (node.tag === 'code') next.code = true;
  if (node.tag === 'br') return [{ text: '\n', ...ctx }];
  return node.children.flatMap((c) => collectInlines(c, next));
}

function normalizeInlines(inlines: Inline[]): Inline[] {
  return inlines
    .map((i) => ({ ...i, text: i.text.replace(/\s+/g, ' ') }))
    .filter((i) => i.text.length > 0);
}

function blocksFrom(node: Node): Block[] {
  const out: Block[] = [];
  for (const child of node.children) {
    if (typeof child === 'string') {
      const inl = normalizeInlines([{ text: child }]);
      if (inl.length) out.push({ type: 'paragraph', inlines: inl });
      continue;
    }
    const t = child.tag;
    if (/^h[1-6]$/.test(t)) {
      out.push({ type: 'heading', level: +t[1], inlines: normalizeInlines(collectInlines(child)) });
    } else if (t === 'p') {
      const inl = normalizeInlines(collectInlines(child));
      if (inl.length) out.push({ type: 'paragraph', inlines: inl });
    } else if (t === 'ul' || t === 'ol') {
      const items = child.children
        .filter((c): c is Node => typeof c !== 'string' && c.tag === 'li')
        .map((li) => normalizeInlines(collectInlines(li)));
      out.push({ type: 'list', ordered: t === 'ol', items });
    } else if (t === 'pre') {
      out.push({ type: 'code', text: textContent(child) });
    } else if (t === 'blockquote') {
      out.push({ type: 'quote', inlines: normalizeInlines(collectInlines(child)) });
    } else if (t === 'hr') {
      out.push({ type: 'hr' });
    } else if (t === 'table') {
      out.push({ type: 'table', rows: parseTable(child) });
    } else if (t === 'div' || t === 'body' || t === 'html' || t === 'section' || t === 'article') {
      out.push(...blocksFrom(child)); // descend into wrappers
    } else {
      const inl = normalizeInlines(collectInlines(child));
      if (inl.length) out.push({ type: 'paragraph', inlines: inl });
    }
  }
  return out;
}

function parseTable(table: Node): Inline[][][] {
  const rows: Inline[][][] = [];
  const walk = (n: Node) => {
    for (const c of n.children) {
      if (typeof c === 'string') continue;
      if (c.tag === 'tr') {
        const cells = c.children
          .filter((x): x is Node => typeof x !== 'string' && (x.tag === 'td' || x.tag === 'th'))
          .map((cell) => normalizeInlines(collectInlines(cell)));
        rows.push(cells);
      } else {
        walk(c);
      }
    }
  };
  walk(table);
  return rows;
}

function textContent(node: Node | string): string {
  if (typeof node === 'string') return node;
  if (node.tag === 'br') return '\n';
  return node.children.map(textContent).join('');
}

/** Strip elements whose text content must never become document content. */
function stripNonContent(html: string): string {
  return html
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '');
}

/** Public entry: HTML string → block list. */
export function htmlToBlocks(html: string): Block[] {
  return blocksFrom(parse(stripNonContent(html)));
}
