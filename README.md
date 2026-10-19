# typical-admin-rn

The [typical-admin](https://github.com/MrDavid5465/typical-admin) pattern
for **React Native**, over a **document the app holds in memory** and saves
in one atomic change: a local-first app, or one whose data is end-to-end
encrypted so no server can query it. One description per record type gives
its screens; the app's skin draws them. It pairs with
[denim-rn](https://github.com/MrDavid5465/denim-rn), the shell.

Consumed as source (no build step, no npm package), for example as a git
submodule at `src/lib/typical-admin-rn`, next to `src/lib/denim-rn` (it
imports `../denim-rn` for the unsaved-changes guard).

## This variant's answers

The pattern guide (typical-admin's `BUILDING-A-VARIANT.md`) asks each
variant to decide these:

| Question | typical-admin-rn |
|---|---|
| Platform, UI kit | React Native (and react-native-web). No UI kit: the app's skin supplies `AdminPrimitives` |
| Data layer | The app's in-memory document plus one `change(fn)` that saves it atomically. List, filter, sort, create, update and delete all run on the device |
| Operations | A record type is a **lens** into the document: `select(doc, ctx)` gives its rows, `write(doc, rows, ctx)` puts them back (and can tidy related data); `create`/`update` build rows from the form |
| Finding results | `select` returns them; nothing is looked up by name |
| Display text | `labels`, always set by the record type |
| Forms | Its own schema (`fields`): a field-type catalog with checks and parsing, `registerFieldType` for an app's own types |
| Lists | `list.columns` (label or text lines, `sensitive`), `list.sort` |
| Routing | None yet: the first mount is **inline** (`AdminPanel`): the form and the list in one card, so unfinished input never goes into a URL. A routed mount (list, `new`, `:id/show`, `:id/edit` under expo-router) is planned for record types that want deep links |
| Live updates | None of its own: when the app's document changes (another device, another tab), the panel re-renders from the new `doc` |
| Distribution | Source, as a submodule |

Not shared with other variants: the schema format, the names, the API.

## Using it

```tsx
// once, near the top (inside denim-rn's DenimProvider)
<AdminProvider primitives={mySkinPrimitives} useHideSensitive={useMyPrivacySwitch}>
  ...
</AdminProvider>

// a panel
<AdminPanel type={researchNotes} ctx={{ symbol }} doc={data} change={fn => save(fn(data))} />
```

`change` gets a function from the current document to the next one; return
`false` (or throw) when nothing was saved, and the panel says so.

## A record type

```ts
export const researchNotes: RecordType<PortfolioData, ResearchNote, { symbol: string }> = {
  name: 'Research note',
  id: note => note.id,
  select: (data, { symbol }) => data.researchNotes?.[symbol] ?? [],
  write: (data, notes, { symbol }) => ({ ...data, researchNotes: { ...data.researchNotes, [symbol]: notes } }),
  create: values => ({ id: newId(), createdAt: new Date().toISOString(), ...values } as ResearchNote),
  fields: {
    fiscalYear: { type: 'year', label: 'Fiscal year', required: true, keep: true,
      defaultValue: () => String(new Date().getFullYear() - 1) },
    body: { type: 'text', label: 'What did you learn?', required: true, multiline: true },
    sourceUrl: { type: 'url', label: 'Source link (optional)' },
  },
  list: {
    sort: (a, b) => b.createdAt.localeCompare(a.createdAt),
    columns: [
      { style: 'label', value: note => `Fiscal ${note.fiscalYear}` },
      { style: 'text', value: note => note.body, sensitive: true },
    ],
  },
  labels: { title: ({ symbol }) => `Research notes · ${symbol}`, save: 'Save research note', ... },
};
```

### Fields

| Property | Meaning |
|---|---|
| `type` | a catalog entry: `text`, `url`, `year`, or one the app registered |
| `label`, `accessibilityLabel` | the input's label and screen-reader name |
| `required` | empty text is an error |
| `message` | the error text for this field (empty or failing the type's check) |
| `validate(text, values)` | an extra rule; return an error or `""` |
| `defaultValue` | text for a new record (a function runs when the form starts) |
| `keep` | keep the text after a save or a cancelled edit |
| `maxLength`, `multiline`, `autoCapitalize` | passed to the skin's input |

The first error in field order is shown as the panel's status line.

Built-in types: `text` (trimmed), `url` (HTTPS, no credentials or fragment;
empty leaves the key out), `year` (four digits, 1900-2200, stored as a
number). Add one with
`registerFieldType(name, { check, message, parse })`, and give the skin an
input for it.

### Behaviour of the inline panel

- Save validates, then builds the row (`create`, or `update`: by default
  the old row without the form's fields, plus the parsed values), puts it
  first (or last: `insert: 'end'`) and calls `change` once.
- Edit fills the form; Cancel edit clears it. Both ask first when the form
  has unsaved text (denim-rn's guard), and so does leaving the screen.
- Remove asks inline, then saves without the row.
- `formActions` sit before Save (e.g. "use the latest filing link");
  `rowActions` before a row's Edit (e.g. "Open source ↗", with a `failure`
  message).
- `sensitive` columns show `labels.hidden` while `useHideSensitive()` is true.

## Writing a skin

`AdminPrimitives`: `Card`, `Group`, `Title`, `Help`, `Message` (announced
status), `Question` (the inline remove question), `RowLabel`, `RowText`,
`Button` (`label`, `onPress`, `disabled`, `role`), and `fields`: one input
component per field type, taking `FieldProps`. typical-admin-rn draws with
nothing else.

## Tests

```sh
npm test    # node --experimental-strip-types --test test/
```
