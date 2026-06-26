import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert } from '../src/convert';
import { detectFormat } from '../src/formats';

const MD = '# Title\n\nSome **bold** and *italic* text.\n\n- one\n- two\n\n| A | B |\n|---|---|\n| 1 | 2 |\n';

test('md → html', async () => {
  const r = await convert(MD, { from: 'md', to: 'html' });
  assert.equal(r.ext, 'html');
  assert.match(r.data.toString(), /<h1>Title<\/h1>/);
});

test('md → pdf produces a real PDF', async () => {
  const r = await convert(MD, { from: 'md', to: 'pdf' });
  assert.equal(r.ext, 'pdf');
  assert.equal(r.data.subarray(0, 4).toString('latin1'), '%PDF');
  assert.ok(r.data.length > 800, 'pdf should have content');
});

test('md → docx produces a valid OOXML zip', async () => {
  const r = await convert(MD, { from: 'md', to: 'docx' });
  assert.equal(r.ext, 'docx');
  assert.equal(r.data.subarray(0, 2).toString('latin1'), 'PK'); // zip magic
});

test('md → docx → md round-trips heading and bold', async () => {
  const docx = await convert(MD, { from: 'md', to: 'docx' });
  const back = await convert(docx.data, { from: 'docx', to: 'md' });
  const text = back.data.toString();
  assert.match(text, /Title/);
  assert.match(text, /\*\*bold\*\*|__bold__/);
});

test('xlsx round-trip: build xlsx → csv → md', async () => {
  const csvIn = 'name,score\nAda,99\nGrace,100\n';
  const xlsx = await convert(csvIn, { from: 'csv', to: 'xlsx' });
  assert.equal(xlsx.data.subarray(0, 2).toString('latin1'), 'PK');

  const csv = await convert(xlsx.data, { from: 'xlsx', to: 'csv' });
  assert.match(csv.data.toString(), /Ada,99/);

  const md = await convert(xlsx.data, { from: 'xlsx', to: 'md' });
  assert.match(md.data.toString(), /\| name \| score \|/);
  assert.match(md.data.toString(), /\| Ada \| 99 \|/);
});

test('xlsx → pdf produces a real PDF', async () => {
  const xlsx = await convert('a,b\n1,2\n', { from: 'csv', to: 'xlsx' });
  const pdf = await convert(xlsx.data, { from: 'xlsx', to: 'pdf' });
  assert.equal(pdf.data.subarray(0, 4).toString('latin1'), '%PDF');
});

test('detectFormat: PDF magic + filename fallback', () => {
  assert.equal(detectFormat(Buffer.from('%PDF-1.7')), 'pdf');
  assert.equal(detectFormat(Buffer.from('x'), undefined, 'r.xlsx'), 'xlsx');
});

test('unsupported conversion gives a clear error', async () => {
  await assert.rejects(
    () => convert('a,b\n1,2\n', { from: 'csv', to: 'docx' }),
    /not supported/i,
  );
});
