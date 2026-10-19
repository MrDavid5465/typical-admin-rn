// The inline mount: one card with the new/edit form on top and the list
// below; Edit fills the form, Remove asks inline. Unfinished input stays out
// of the URL, so this mount has no routes. Everything is drawn with the
// skin's primitives (AdminProvider).
import React, { createContext, useContext, useState } from 'react';
import { useDraftChanges } from '../denim-rn';
import { clearedValues, firstError, formValues, parsedValues, updatedRow } from './fields';
import type { AdminPrimitives, DocumentAccess, FormValues, RecordType } from './types';

interface IAdminContext {
  primitives: AdminPrimitives;
  /** Whether sensitive columns are hidden right now (a hook, called once per panel). */
  useHideSensitive: () => boolean;
}
const AdminContext = createContext<IAdminContext | null>(null);

const never = () => false;

/** Gives every panel below it the skin's primitives and the privacy switch. */
export function AdminProvider({ primitives, useHideSensitive = never, children }: {
  primitives: AdminPrimitives;
  useHideSensitive?: () => boolean;
  children?: React.ReactNode;
}) {
  return <AdminContext.Provider value={{ primitives, useHideSensitive }}>{children}</AdminContext.Provider>;
}

function useAdmin(): IAdminContext {
  const ctx = useContext(AdminContext);
  if (!ctx) throw Error('typical-admin-rn: AdminPanel needs <AdminProvider> above it.');
  return ctx;
}

const errorText = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export type AdminPanelProps<Doc, T, Ctx> = DocumentAccess<Doc> & {
  type: RecordType<Doc, T, Ctx>;
  ctx: Ctx;
};

export function AdminPanel<Doc, T, Ctx>({ type, ctx, doc, change }: AdminPanelProps<Doc, T, Ctx>) {
  const { primitives: p, useHideSensitive } = useAdmin();
  const hideSensitive = useHideSensitive();
  const { fields, labels, list } = type;
  const rows = type.select(doc, ctx);
  const [values, setValues] = useState<FormValues>(() => formValues(fields));
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const draft = useDraftChanges(values, true, saved => { setValues(saved); setMessage(''); });
  const set = (name: string, value: string) => setValues(current => ({ ...current, [name]: value }));
  const save = (next: T[]) => change(current => type.write(current, next, ctx));

  async function submit() {
    if (busy) return;
    const error = firstError(fields, values);
    if (error) { setMessage(error); return; }
    setBusy(true); setMessage('');
    const parsed = parsedValues(fields, values);
    const previous = editing === null ? undefined : rows.find(row => type.id(row) === editing);
    const row = previous
      ? (type.update ?? ((r: T, v: Record<string, unknown>) => updatedRow(fields, r, v)))(previous, parsed)
      : type.create(parsed, ctx);
    const next = previous
      ? rows.map(item => type.id(item) === editing ? row : item)
      : type.insert === 'end' ? [...rows, row] : [row, ...rows];
    try {
      if (await save(next)) {
        const cleared = clearedValues(fields, values);
        draft.markSaved(cleared); setEditing(null); setValues(cleared); setMessage(labels.saved);
      } else setMessage(labels.saveFailed);
    } catch (error) { setMessage(errorText(error, labels.saveFailed)); }
    finally { setBusy(false); }
  }

  function edit(row: T) {
    draft.leave(() => {
      const loaded = formValues(fields, row as Record<string, unknown>);
      draft.markSaved(loaded); setEditing(type.id(row)); setValues(loaded);
    });
  }

  function cancelEdit() {
    draft.leave(() => {
      const cleared = clearedValues(fields, values);
      setEditing(null); setValues(cleared); draft.markSaved(cleared);
    });
  }

  function remove(row: T) {
    const id = type.id(row);
    setBusy(true);
    void save(rows.filter(item => type.id(item) !== id))
      .then(saved => { if (saved) setRemoving(null); else setMessage(labels.removeFailed); })
      .catch(error => setMessage(errorText(error, labels.removeFailed)))
      .finally(() => setBusy(false));
  }

  function runRowAction(run: () => void | Promise<unknown>, failure?: string) {
    const fail = (error: unknown) => setMessage(failure ?? errorText(error, ''));
    try { void Promise.resolve(run()).catch(fail); } catch (error) { fail(error); }
  }

  const title = typeof labels.title === 'function' ? labels.title(ctx) : labels.title;
  const sorted = list.sort ? [...rows].sort(list.sort) : rows;
  return (
    <p.Card>
      <p.Title>{title}</p.Title>
      {!!labels.description && <p.Help>{labels.description}</p.Help>}
      {Object.entries(fields).map(([name, field]) => {
        const Input = p.fields[field.type];
        if (!Input) throw Error(`typical-admin-rn: the skin has no input for field type "${field.type}".`);
        return (
          <Input key={name} label={field.label} accessibilityLabel={field.accessibilityLabel}
            value={values[name] ?? ''} onChange={value => set(name, value)}
            maxLength={field.maxLength} multiline={field.multiline} autoCapitalize={field.autoCapitalize} />
        );
      })}
      {(type.formActions ?? []).filter(action => action.when?.(ctx) ?? true).map(action => (
        <p.Button key={action.label} label={action.label} onPress={() => action.run({ values, set }, ctx)} />
      ))}
      <p.Button label={editing ? labels.saveChanges : labels.save} disabled={busy} onPress={() => void submit()} />
      {editing && <p.Button label={labels.cancelEdit} onPress={cancelEdit} />}
      {!!message && <p.Message>{message}</p.Message>}
      {sorted.map(row => {
        const id = type.id(row);
        return (
          <p.Card key={id}>
            {list.columns.map((column, i) => {
              const text = column.sensitive && hideSensitive ? labels.hidden : column.value(row);
              return column.style === 'label'
                ? <p.RowLabel key={i}>{text}</p.RowLabel>
                : <p.RowText key={i}>{text}</p.RowText>;
            })}
            {(type.rowActions ?? []).filter(action => action.when?.(row) ?? true).map(action => (
              <p.Button key={action.label} label={action.label} role={action.role}
                onPress={() => runRowAction(() => action.run(row), action.failure)} />
            ))}
            <p.Button label={labels.edit} onPress={() => edit(row)} />
            <p.Button label={labels.remove} onPress={() => setRemoving(id)} />
            {removing === id && <p.Group>
              <p.Question>{labels.removeQuestion}</p.Question>
              <p.Button label={labels.confirmRemove} disabled={busy} onPress={() => remove(row)} />
              <p.Button label={labels.keep} onPress={() => setRemoving(null)} />
            </p.Group>}
          </p.Card>
        );
      })}
    </p.Card>
  );
}
