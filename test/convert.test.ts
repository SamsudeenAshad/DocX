import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert } from '../src/convert';
import { markdownToHtml, htmlToMarkdown } from '../src/markdown';
import { detectFormat } from '../src/formats';

test('markdown → html → markdown round-trips headings and lists', () => {
  const md = '# Title\n\nSome **bold** text.\n\n- a\n- b\n';
  const html = markdownToHtml(md);
  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  const back = htmlToMarkdown(html);
  assert.match(back, /# Title/);
  assert.match(back, /-\s+a/);
  assert.doesNotMatch(back, /font-family/); // inline CSS must not leak through
});

test('convert md → html (pure JS, no LibreOffice needed)', async () => {
  const res = await convert('# Hello\n', { from: 'md', to: 'html' });
  assert.equal(res.ext, 'html');
  assert.match(res.data.toString('utf8'), /<h1>Hello<\/h1>/);
});

test('detectFormat recognises PDF magic bytes', () => {
  const pdf = Buffer.from('%PDF-1.7\n...', 'latin1');
  assert.equal(detectFormat(pdf), 'pdf');
});

test('detectFormat falls back to filename extension', () => {
  assert.equal(detectFormat(Buffer.from('x'), undefined, 'report.xlsx'), 'xlsx');
});

test('same-format conversion is a passthrough', async () => {
  const res = await convert(Buffer.from('hi'), { from: 'txt', to: 'txt' });
  assert.equal(res.data.toString(), 'hi');
});
