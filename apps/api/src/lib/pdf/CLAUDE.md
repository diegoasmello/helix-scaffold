# lib/pdf — PDF generation infrastructure

Server-side PDF rendering using `@react-pdf/renderer`. This library uses React's reconciler to produce PDF bytes directly — no browser, no headless Chrome. It runs inside Fastify route handlers and outputs a `Buffer` that is streamed back as `application/pdf`.

> `jsx: "react-jsx"` is enabled in `apps/api/tsconfig.json` so `.tsx` files compile correctly here. `react` and `@types/react` are listed as direct deps in `apps/api/package.json`.

## Files

| File | Purpose |
|------|---------|
| `base-document.tsx` | Shared page shell: header (title + date), content slot, page-number footer |
| `pdf-styles.ts` | Design tokens (`pdfColors`) and reusable base styles (`pdfStyles`) |
| `pdf-table.tsx` | Generic table component (`PdfTable`) for tabular reports |

## `BaseDocument`

Wraps every report. Provides a consistent layout so all reports look the same without boilerplate.

```tsx
import { BaseDocument } from '@/lib/pdf/base-document'

<BaseDocument title="My Report">
  {/* report-specific content */}
</BaseDocument>
```

Renders:
- **Header**: title (left, primary blue, 18pt bold) + generation date (right, muted, 9pt)
- **Content**: `flex: 1` area — children go here
- **Footer**: `pageNumber / totalPages`, centered, fixed on every page

## `pdfColors`

```ts
pdfColors.primary    // #1b59f8 — headings, accents
pdfColors.text       // #1a1a1a — body text
pdfColors.muted      // #6b7280 — labels, secondary info
pdfColors.border     // #e5e7eb — dividers, table borders
pdfColors.background // #f3f4f6 — table header rows, shaded cells
```

## `pdfStyles`

Base styles for `BaseDocument` internals (`page`, `header`, `headerTitle`, `headerMeta`, `content`, `footer`). Templates should not import `pdfStyles` directly — they only need `pdfColors` for their own `StyleSheet.create` blocks.

## `PdfTable`

Generic table component for tabular reports. Owns the shared table chrome (header row style, data row style, font sizes, colors) so individual templates only declare their column definitions.

```tsx
import { PdfTable, type PdfColumn } from '@/lib/pdf/pdf-table'
```

**`PdfColumn<T>`** — describes one column:

| Field | Type | Description |
|-------|------|-------------|
| `header` | `string` | Column heading text |
| `style` | `Style` (optional) | Column width / alignment — pass a `StyleSheet.create` entry |
| `render` | `(item: T) => string` | Extracts the cell value as a plain string |

**Usage in a template:**

```tsx
import { StyleSheet, Text } from '@react-pdf/renderer'
import { PdfTable, type PdfColumn } from '@/lib/pdf/pdf-table'
import { pdfColors } from '@/lib/pdf/pdf-styles'

const styles = StyleSheet.create({
  summary: { marginBottom: 16, fontSize: 10, color: pdfColors.muted },
  colName:   { flex: 3 },
  colStatus: { flex: 1, textAlign: 'center' },
})

const columns: PdfColumn<FeatureRow>[] = [
  { header: 'Name',   style: styles.colName,   render: (item) => item.name },
  { header: 'Status', style: styles.colStatus, render: (item) => item.status },
]

// Inside the document component:
<BaseDocument title="Feature Report">
  <Text style={styles.summary}>{items.length} item(s)</Text>
  <PdfTable columns={columns} data={items} keyExtractor={(item) => item.id} />
</BaseDocument>
```

**Notes:**
- `render` must return a `string`. Format dates, nullables, and enums before returning.
- `style` accepts the result of `StyleSheet.create` for a single key — never an inline object.
- `PdfTable` owns `tableHeader`, `tableRow`, `headerText`, and `cellText` styles internally. Templates only need to define column-specific styles (`flex`, `textAlign`).

## Creating a new report template

Templates live in the module that owns the data:

```
apps/api/src/modules/<feature>/templates/<feature>-report.tsx
```

**Standard template structure (tabular report):**

Most reports are tables — use `PdfTable` rather than building rows manually:

```tsx
import { renderToBuffer } from '@react-pdf/renderer'
import { StyleSheet, Text } from '@react-pdf/renderer'

import { BaseDocument } from '@/lib/pdf/base-document'
import { PdfTable, type PdfColumn } from '@/lib/pdf/pdf-table'
import { pdfColors } from '@/lib/pdf/pdf-styles'

type FeatureRow = typeof features.$inferSelect

const styles = StyleSheet.create({
  summary: { fontSize: 10, color: pdfColors.muted, marginBottom: 16 },
  colName:   { flex: 3 },
  colStatus: { flex: 1, textAlign: 'center' },
  colDate:   { flex: 1, textAlign: 'right' },
})

const columns: PdfColumn<FeatureRow>[] = [
  { header: 'Name',   style: styles.colName,   render: (item) => item.name },
  { header: 'Status', style: styles.colStatus, render: (item) => item.status },
  { header: 'Date',   style: styles.colDate,   render: (item) => item.createdAt.toLocaleDateString('en-US', { dateStyle: 'short' }) },
]

interface FeatureReportDocumentProps {
  items: FeatureRow[]
}

function FeatureReportDocument(props: Readonly<FeatureReportDocumentProps>) {
  const { items } = props
  return (
    <BaseDocument title="Feature Report">
      <Text style={styles.summary}>{items.length} item(s)</Text>
      <PdfTable columns={columns} data={items} keyExtractor={(item) => item.id} />
    </BaseDocument>
  )
}

export async function renderFeatureReport(items: FeatureRow[]): Promise<Buffer> {
  return renderToBuffer(<FeatureReportDocument items={items} />)
}
```

**Rules:**
- Always use `StyleSheet.create` — never inline style objects (`style={{ ... }}`)
- `@react-pdf/renderer` does not render HTML. Never pass rich-text HTML strings into `<Text>` — strip tags or use a plain-text fallback
- The exported function must be `async` and return `Promise<Buffer>`
- Import the template via dynamic `import()` in the service (see below) so the React/PDF runtime is only loaded when the route is actually called
- Use `PdfTable` for tabular data — only build rows manually for non-tabular layouts

## Connecting a template to a service

Use a **dynamic import** inside the service function to defer loading the PDF runtime:

```ts
async function generateReport(query: FeatureExportQuery): Promise<Buffer> {
  const data = await database
    .select()
    .from(features)
    .where(where)
    .orderBy(sortFn(sortCol))
    .limit(5000)                // always cap — never unbounded

  const { renderFeatureReport } = await import('./templates/feature-report')
  return renderFeatureReport(data)
}
```

The `.limit(5000)` cap is mandatory. Without it a single export can exhaust process memory and serve as a DoS vector.

## Connecting to a route

See `apps/api/CLAUDE.md` → _PDF export_ for the full route pattern including try/catch, audit metadata, and response headers.
