# lib/pdf — PDF generation infrastructure

Server-side PDF rendering using `@react-pdf/renderer`. This library uses React's reconciler to produce PDF bytes directly — no browser, no headless Chrome. It runs inside Fastify route handlers and outputs a `Buffer` that is streamed back as `application/pdf`.

> `jsx: "react-jsx"` is enabled in `apps/api/tsconfig.json` so `.tsx` files compile correctly here. `react` and `@types/react` are listed as direct deps in `apps/api/package.json`.

## Files

| File | Purpose |
|------|---------|
| `base-document.tsx` | Shared page shell: header (title + date), content slot, page-number footer |
| `pdf-styles.ts` | Design tokens (`pdfColors`) and reusable base styles (`pdfStyles`) |

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

## Creating a new report template

Templates live in the module that owns the data:

```
apps/api/src/modules/<feature>/templates/<feature>-report.tsx
```

**Minimal template structure:**

```tsx
import { renderToBuffer } from '@react-pdf/renderer'
import { StyleSheet, Text, View } from '@react-pdf/renderer'

import { BaseDocument } from '@/lib/pdf/base-document'
import { pdfColors } from '@/lib/pdf/pdf-styles'

// Define styles with StyleSheet.create — never use inline style objects
const styles = StyleSheet.create({
  summary: { fontSize: 10, color: pdfColors.muted, marginBottom: 16 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: pdfColors.border },
  cell: { fontSize: 9, padding: 6 },
})

interface FeatureReportDocumentProps {
  items: FeatureRow[]
}

function FeatureReportDocument(props: Readonly<FeatureReportDocumentProps>) {
  const { items } = props
  return (
    <BaseDocument title="Feature Report">
      <Text style={styles.summary}>{items.length} item(s)</Text>
      {items.map((item) => (
        <View key={item.id} style={styles.row}>
          <Text style={styles.cell}>{item.title}</Text>
        </View>
      ))}
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
