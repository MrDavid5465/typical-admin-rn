import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearedValues, firstError, formValues, parsedValues, updatedRow, validHttpsUrl } from '../fields.ts';

const fields = {
  fiscalYear: { type: 'year', label: 'Fiscal year', required: true, message: 'Year and note, please.', defaultValue: () => '2025', keep: true },
  body: { type: 'text', label: 'Note', required: true, message: 'Year and note, please.' },
  sourceUrl: { type: 'url', label: 'Source', message: 'HTTPS only.' },
};

test('new and edit form values', () => {
  assert.deepEqual(formValues(fields), { fiscalYear: '2025', body: '', sourceUrl: '' });
  assert.deepEqual(formValues(fields, { fiscalYear: 2020, body: 'x' }), { fiscalYear: '2020', body: 'x', sourceUrl: '' });
});

test('errors come in schema order, with field messages', () => {
  assert.equal(firstError(fields, { fiscalYear: '20', body: '', sourceUrl: 'http://x' }), 'Year and note, please.');
  assert.equal(firstError(fields, { fiscalYear: '2024', body: ' ', sourceUrl: '' }), 'Year and note, please.');
  assert.equal(firstError(fields, { fiscalYear: '2024', body: 'ok', sourceUrl: 'http://x' }), 'HTTPS only.');
  assert.equal(firstError(fields, { fiscalYear: '2024', body: ' ok', sourceUrl: '' }), '');
});

test('parsing trims, converts and leaves out empty optional links', () => {
  assert.deepEqual(parsedValues(fields, { fiscalYear: ' 2024 ', body: ' note ', sourceUrl: ' ' }), { fiscalYear: 2024, body: 'note' });
  assert.deepEqual(parsedValues(fields, { fiscalYear: '2024', body: 'n', sourceUrl: ' https://a.b/c ' }),
    { fiscalYear: 2024, body: 'n', sourceUrl: 'https://a.b/c' });
});

test('an edit drops a cleared field and keeps the rest of the row', () => {
  const row = { id: 'n1', createdAt: 't', fiscalYear: 2020, body: 'old', sourceUrl: 'https://a.b' };
  assert.deepEqual(updatedRow(fields, row, { fiscalYear: 2021, body: 'new' }), { id: 'n1', createdAt: 't', fiscalYear: 2021, body: 'new' });
});

test('after a save, kept fields stay', () => {
  assert.deepEqual(clearedValues(fields, { fiscalYear: '2019', body: 'b', sourceUrl: 'u' }), { fiscalYear: '2019', body: '', sourceUrl: '' });
});

test('https links without credentials or fragments', () => {
  assert.equal(validHttpsUrl('https://example.com/a'), true);
  assert.equal(validHttpsUrl('https://u:p@example.com'), false);
  assert.equal(validHttpsUrl('https://example.com/#x'), false);
  assert.equal(validHttpsUrl('http://example.com'), false);
});
