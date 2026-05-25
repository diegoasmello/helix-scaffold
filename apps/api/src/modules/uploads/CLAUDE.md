# uploads module — backend

Standalone module for file uploads. Exposes `POST /uploads` (multipart), list, detail, and delete. Other modules attach files by adding a junction table — see _Adding uploads to another module_ below.

## Endpoints

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| `POST /uploads` | `uploads:create` | Multipart — no Zod body schema; validated manually |
| `GET /uploads` | `uploads:view` | Paginated list |
| `GET /uploads/:id` | `uploads:view` | Single upload |
| `DELETE /uploads/:id` | `uploads:delete` | Removes from DB **and** storage |

## `POST /uploads` handler flow

Body is `multipart/form-data` — `@fastify/multipart` is registered globally in `app.ts`. No Zod body schema is declared on this route.

1. `const data = await request.file()` — reads the multipart field named `file`
2. Validate MIME type against `ALLOWED_MIME_TYPES` (defined in `uploads-schema.ts`)
3. Validate file size against `env.UPLOAD_MAX_SIZE_MB`
4. `await data.toBuffer()` — buffer the stream
5. If image: `processImage(buffer, mimeType)` → save each variant to storage with key `<id>/<variant>.<ext>`
6. Save original to storage with key `<id>/original.<ext>`
7. Insert row into `uploads` table (with `variants` JSONB if image, `null` otherwise)
8. `request.audit('create', 'uploads', upload.id, { originalName, mimeType, fileSize })`
9. Return `201` + upload object

## Allowed MIME types

Defined as `ALLOWED_MIME_TYPES` in `uploads-schema.ts`:

- **Images**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/avif`, `image/svg+xml`
- **Documents**: `application/pdf`, `application/msword`, `.docx`, `text/plain`, `.xls`, `.xlsx`
- **Audio**: `audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/aac`, `audio/flac`
- **Video**: `video/mp4`, `video/webm`, `video/ogg`, `video/quicktime`

## Storage keys

Each upload gets a UUID (uuidv7) as its `id`. Storage keys follow the pattern:

```
<id>/original.<ext>       ← always saved
<id>/thumbnail.webp       ← images only
<id>/small.webp           ← images only
<id>/medium.webp          ← images only
<id>/large.webp           ← images only
```

SVG files are stored as-is (no variants generated).

## `uploads` table

```ts
{
  id: text (PK, uuidv7)
  originalName: text
  mimeType: text
  fileSize: integer          // bytes
  storageKey: text           // key of the original file (used for deletion)
  url: text                  // public URL of the original file
  variants: jsonb | null     // { thumbnail, small, medium, large } — each { key, url }
  uploadedBy: text | null    // FK → user.id, set null on user delete
  createdAt: timestamp
}
```

## Cascade deletion

`service.remove(id)` always:
1. Fetches the upload record
2. Deletes all storage keys: original + all variant keys (if present)
3. Deletes the DB row

Always call `service.remove()` instead of a raw DB delete when storage cleanup is needed.

## Image variants

`processImage(buffer, mimeType)` from `src/lib/image-processor.ts`:

| Variant | Dimensions | Format |
|---------|-----------|--------|
| `thumbnail` | 200×200 px (square crop) | WebP |
| `small` | 480px wide | WebP |
| `medium` | 960px wide | WebP |
| `large` | 1920px wide | WebP |

Only called when `mimeType.startsWith('image/')` and the type is not SVG.

## Adding uploads to another module

The `todos` module is the reference implementation. The pattern:

### 1. Junction table

```ts
// src/db/schema/xxx-attachments.ts
export const xxxAttachments = pgTable('xxx_attachments', {
  xxxId:    text('xxx_id').notNull().references(() => xxx.id, { onDelete: 'cascade' }),
  uploadId: text('upload_id').notNull().references(() => uploads.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.xxxId, t.uploadId] })])
```

### 2. Schema changes

```ts
// response schema — include full upload objects
xxxSchema = z.object({ ..., attachments: uploadSchema.array() })

// create/update schemas — accept IDs only
createXxxSchema = z.object({ ..., attachmentIds: z.array(z.string()).optional().default([]) })
```

### 3. Service changes

Pass `storage: StorageProvider` into the service factory alongside `database`.

- **reads** (`getById`, `list`) — LEFT JOIN `xxx_attachments` + `uploads` and aggregate into `attachments: Upload[]`
- **create** — after inserting the record, insert rows into `xxx_attachments` for each `attachmentId`
- **update** — DELETE existing `xxx_attachments` rows, INSERT new ones (simple full sync)
- **delete** (`remove`):
  1. Fetch attachment upload IDs via JOIN
  2. Delete the `xxx` record (cascades `xxx_attachments`)
  3. Delete the `uploads` rows
  4. Delete storage keys best-effort (after DB commits)

### 4. Route options

```ts
export async function xxxRoutes(
  app,
  { database, requirePermission, storage }: { ..., storage: StorageProvider }
) {
  const service = createXxxService(database, storage)
  // ...
}
```

Register in `app.ts` passing the shared `storage` instance:

```ts
authenticated.register(xxxRoutes, { database, requirePermission, storage })
```

### 5. Register upload references for orphan cleanup

Uploads are persisted immediately when the user selects a file — before the parent record exists. If the user abandons the form, those uploads become orphaned. A scheduled job (`deleteOrphanUploads`) runs every 6 hours and removes uploads older than 24 hours that are not referenced by any module.

For the job to know which uploads are in use, every column that references `uploads.id` must be registered in `src/config/upload-references.ts`:

```ts
// src/config/upload-references.ts
import { isNotNull } from 'drizzle-orm'
import { xxxAttachments, xxx } from '@/db/schema'
import { registerUploadReference } from '@/lib/upload-references'

// Junction table column (NOT NULL — no filter needed)
registerUploadReference(async (db) => {
  const rows = await db.selectDistinct({ id: xxxAttachments.uploadId }).from(xxxAttachments)
  return rows.map((r) => r.id)
})

// Direct FK column (nullable — filter nulls)
registerUploadReference(async (db) => {
  const rows = await db.select({ id: xxx.fileId }).from(xxx).where(isNotNull(xxx.fileId))
  return rows.map((r) => r.id).filter((id): id is string => id !== null)
})
```

Add one `registerUploadReference` call per column. If a module's uploads are not registered, the job will treat them as orphaned and delete them after the grace period.
