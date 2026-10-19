// The field-type catalog: how each type checks and parses its text. Pure,
// so forms can be tested without React. The skin supplies one input
// component per type (AdminPrimitives.fields); an app adds a type of its own
// with registerFieldType.
import type { FieldDef, FormValues } from './types';

export interface FieldType {
  /** Whether non-empty text is acceptable. Default: anything. */
  check?: (text: string) => boolean;
  /** Error text when `check` fails (a field's own `message` wins). */
  message: string;
  /** Stored value from the text; `undefined` leaves the key out of the record. */
  parse: (text: string) => unknown;
}

/** Four digits, 1900-2200. */
export function validYear(text: string, { min = 1900, max = 2200 } = {}) {
  const year = Number(text.trim());
  return /^\d{4}$/.test(text.trim()) && year >= min && year <= max;
}

/** An HTTPS link without credentials or a fragment, at most 2,000 characters. */
export function validHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash && value.length <= 2000;
  } catch { return false; }
}

const catalog: Record<string, FieldType> = {
  text: { message: 'Enter some text.', parse: text => text.trim() },
  url: {
    check: text => validHttpsUrl(text.trim()),
    message: 'Use an HTTPS link without credentials or a fragment.',
    parse: text => text.trim() || undefined,
  },
  year: { check: validYear, message: 'Enter a four-digit year.', parse: text => Number(text.trim()) },
};

export function registerFieldType(name: string, type: FieldType) {
  catalog[name] = type;
}

export function fieldType(name: string): FieldType {
  const type = catalog[name];
  if (!type) throw Error(`typical-admin-rn: unknown field type "${name}". Register it with registerFieldType.`);
  return type;
}

const initial = (field: FieldDef) =>
  typeof field.defaultValue === 'function' ? field.defaultValue() : field.defaultValue ?? '';

/** The form for a new record, or for editing `row` (its values as text). */
export function formValues(fields: Record<string, FieldDef>, row?: Record<string, unknown>): FormValues {
  return Object.fromEntries(Object.entries(fields).map(([name, field]) => [
    name,
    row ? (row[name] === undefined || row[name] === null ? '' : String(row[name])) : initial(field),
  ]));
}

/** After a save or a cancelled edit: `keep` fields stay, the rest start over. */
export function clearedValues(fields: Record<string, FieldDef>, values: FormValues): FormValues {
  return Object.fromEntries(Object.entries(fields).map(([name, field]) => [
    name,
    field.keep ? values[name] ?? '' : field.defaultValue === undefined ? '' : initial(field),
  ]));
}

/** Each field's first error ("" when fine), in schema order. */
export function fieldErrors(fields: Record<string, FieldDef>, values: FormValues): Record<string, string> {
  return Object.fromEntries(Object.entries(fields).map(([name, field]) => {
    const text = values[name] ?? '';
    const type = fieldType(field.type);
    let error = '';
    if (!text.trim()) { if (field.required) error = field.message ?? 'This field is required.'; }
    else if (type.check && !type.check(text)) error = field.message ?? type.message;
    if (!error && field.validate) error = field.validate(text, values);
    return [name, error];
  }));
}

/** The first error in schema order, or "". */
export function firstError(fields: Record<string, FieldDef>, values: FormValues): string {
  return Object.values(fieldErrors(fields, values)).find(Boolean) ?? '';
}

/** The stored values: each field's parse, leaving out `undefined`. */
export function parsedValues(fields: Record<string, FieldDef>, values: FormValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(fields)) {
    const value = fieldType(field.type).parse(values[name] ?? '');
    if (value !== undefined) out[name] = value;
  }
  return out;
}

/** Default update: the old row without the form's fields, plus the parsed values. */
export function updatedRow<T>(fields: Record<string, FieldDef>, row: T, parsed: Record<string, unknown>): T {
  const rest: Record<string, unknown> = { ...(row as Record<string, unknown>) };
  for (const name of Object.keys(fields)) delete rest[name];
  return { ...rest, ...parsed } as T;
}
