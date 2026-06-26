import { marked } from 'marked';
import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

/** Render Markdown to a standalone HTML document. */
export function markdownToHtml(md: string): string {
  const body = marked.parse(md, { async: false }) as string;
  return [
    '<!DOCTYPE html>',
    '<html><head><meta charset="utf-8">',
    '<style>',
    'body{font-family:"Liberation Sans",Arial,sans-serif;font-size:11pt;line-height:1.45;margin:2em;}',
    'h1,h2,h3,h4{font-family:inherit;line-height:1.25;}',
    'code,pre{font-family:"Liberation Mono",monospace;}',
    'pre{background:#f4f4f4;padding:.6em;border-radius:4px;overflow:auto;}',
    'code{background:#f4f4f4;padding:.1em .3em;border-radius:3px;}',
    'pre code{background:none;padding:0;}',
    'table{border-collapse:collapse;}',
    'th,td{border:1px solid #999;padding:.3em .6em;}',
    'blockquote{border-left:3px solid #ccc;margin:0;padding-left:1em;color:#555;}',
    'img{max-width:100%;}',
    '</style></head><body>',
    body,
    '</body></html>',
  ].join('\n');
}

/** Convert an HTML document/fragment to Markdown. */
export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html).trim() + '\n';
}
