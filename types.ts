// typical-admin-rn's record-type description: one object per record type
// gives its inline panel (list + new/edit form + delete). See README.
import type React from 'react';

/** Form values are the inputs' text, by field name. */
export type FormValues = Record<string, string>;

/** One form field. `type` names an entry in the field-type catalog (fields.ts). */
export interface FieldDef {
  type: string;
  label: string;
  /** Screen-reader name, when it differs from `label`. */
  accessibilityLabel?: string;
  /** An empty value is an error. */
  required?: boolean;
  /** Shown for any error on this field (required, or the type's own check), instead of the type's message. */
  message?: string;
  /** Extra rule after the type's own: return an error message, or "" when fine. */
  validate?: (value: string, values: FormValues) => string;
  /** Initial text for a new record (a function is called when the form starts). */
  defaultValue?: string | (() => string);
  /** Keep this field's text after a save or a cancelled edit, instead of clearing it. */
  keep?: boolean;
  /** Text-input options passed to the skin's input. */
  maxLength?: number;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

/** One line of a row in the list. */
export interface ColumnDef<T> {
  /** The line's text. */
  value: (row: T) => string;
  /** Which skin primitive draws it: a heading-like label, or body text. */
  style?: 'label' | 'text';
  /** Replaced by `labels.hidden` while the app hides sensitive values. */
  sensitive?: boolean;
}

export interface ListDef<T> {
  columns: ColumnDef<T>[];
  /** Display order (the stored order is left alone). */
  sort?: (a: T, b: T) => number;
}

/** An action next to Save, e.g. "use the latest filing link". */
export interface FormAction<Ctx> {
  label: string;
  when?: (ctx: Ctx) => boolean;
  run: (form: { values: FormValues; set: (name: string, value: string) => void }, ctx: Ctx) => void;
}

/** An action on a row, before Edit and Remove. */
export interface RowAction<T> {
  label: string;
  role?: 'button' | 'link';
  when?: (row: T) => boolean;
  run: (row: T) => void | Promise<unknown>;
  /** Shown when `run` throws or rejects. */
  failure?: string;
}

/** Display text, all overridable. Functions get the panel's context. */
export interface Labels<Ctx> {
  title: string | ((ctx: Ctx) => string);
  description?: string;
  save: string;
  saveChanges: string;
  cancelEdit: string;
  saved: string;
  saveFailed: string;
  edit: string;
  remove: string;
  removeQuestion: string;
  confirmRemove: string;
  keep: string;
  removeFailed: string;
  hidden: string;
}

/**
 * A record type is a lens into the app's document: where its rows live
 * (`select`), how to put changed rows back (`write`, which can also tidy
 * related data), how rows map to and from the form, and its schemas.
 */
export interface RecordType<Doc, T, Ctx = void> {
  name: string;
  id: (row: T) => string;
  select: (doc: Doc, ctx: Ctx) => T[];
  write: (doc: Doc, rows: T[], ctx: Ctx) => Doc;
  /** A new row from the parsed form values (add an id, timestamps...). */
  create: (parsed: Record<string, unknown>, ctx: Ctx) => T;
  /**
   * An edited row. Default: the old row without the form's fields, plus the
   * parsed values (so a field cleared to "absent" disappears).
   */
  update?: (row: T, parsed: Record<string, unknown>) => T;
  /** Where a new row goes in the stored list. Default "start". */
  insert?: 'start' | 'end';
  fields: Record<string, FieldDef>;
  list: ListDef<T>;
  labels: Labels<Ctx>;
  formActions?: FormAction<Ctx>[];
  rowActions?: RowAction<T>[];
}

/** The app's document and its one atomic write (the variant's whole data layer). */
export interface DocumentAccess<Doc> {
  doc: Doc;
  /** Apply `fn` and save; false (or a throw) when nothing was saved. */
  change: (fn: (doc: Doc) => Doc) => Promise<boolean>;
}

/** What a skin's field component gets. */
export interface FieldProps {
  label: string;
  accessibilityLabel?: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  multiline?: boolean;
  autoCapitalize?: FieldDef['autoCapitalize'];
}

/**
 * The skin's primitives: typical-admin-rn draws every panel with these and
 * nothing else, so the app's look stays the app's.
 */
export interface AdminPrimitives {
  Card: React.ComponentType<{ children?: React.ReactNode }>;
  /** Groups a few elements (the inline remove question and its buttons). */
  Group: React.ComponentType<{ children?: React.ReactNode }>;
  Title: React.ComponentType<{ children: string }>;
  Help: React.ComponentType<{ children: string }>;
  /** A status line (announced). */
  Message: React.ComponentType<{ children: string }>;
  /** The inline "remove this?" question. */
  Question: React.ComponentType<{ children: string }>;
  RowLabel: React.ComponentType<{ children: string }>;
  RowText: React.ComponentType<{ children: string }>;
  Button: React.ComponentType<{ label: string; onPress: () => void; disabled?: boolean; role?: 'button' | 'link' }>;
  /** One input component per field type the app uses. */
  fields: Record<string, React.ComponentType<FieldProps>>;
}
