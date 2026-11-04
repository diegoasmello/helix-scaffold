# uploads module — backend

Standalone module for file uploads. Exposes `POST /uploads` (multipart), list, detail, and delete. Other modules attach files with a junction table (multi-file) or a nullable FK column (single file) — see _Adding uploads to another module_ below. There is no admin UI over `GET /uploads`; the frontend only calls `POST /uploads` (`apps/web/src/modules/uploads/service.ts`).

## Endpoints

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| `POST` | `/uploads` | `uploads:create` | Multipart — no Zod body schema; validated manually |
| `GET` | `/uploads` | `uploads:view` | Paginated list (sort: `originalName`, `createdAt`) |
| `GET` | `/uploads/:id` | `uploads:view` | Single upload |
| `DELETE` | `/uploads/:id` | `uploads:delete` | Removes from DB **and** storage |
| `GET` | `/files/*` | session + see _Serving files_ | The stored files (`url`, `variants.*.url`); hidden from the spec |

## Serving files

`GET /files/<storage key>` (`upload-files-routes.ts`) sits in the `authenticated` scope. It looks up the upload that owns the key (`service.getByFileKey()` — its `storageKey` or a variant key) and sends the file with `reply.sendFile()` (`@fastify/static`, `serve: false`) only when the user:

1. uploaded it (`uploadedBy`) — the form shows a file before its record exists;
2. holds `uploads:view`; or
3. passes the `access` of a registered reference that points to it (`src/config/upload-references.ts`, step 5 below) — the permission and subscription of the record's `GET` route.

Anyone else, a key no upload owns, and a missing file all get 404. `<img>` tags work because the browser sends the session cookie with them.

The Content-Type comes from the file's extension, which the uploader chose, so an `onSend` hook sets on every file `X-Content-Type-Options: nosniff` and `Cache-Control: private, max-age=0`. A file opens in the browser only when its Content-Type is `image/*`, `audio/*`, `video/*`, `application/pdf` or `text/plain` — and not XML (`image/svg+xml`). Any other file (HTML, SVG, XML, JavaScript, Office documents…) gets `Content-Disposition: attachment` and `Content-Security-Policy: default-src 'none'; sandbox`, so it can never run script on the API's origin.

## `POST /uploads` handler flow

Body is `multipart/form-data` — `@fastify/multipart` is registered globally in `app.ts`. No Zod body schema is declared on this route.

1. `const data = await request.file()` — reads the multipart file; `400 No file provided` when absent
2. Validate MIME type against `ALLOWED_MIME_TYPES` (`uploads-schema.ts`); `400 File type '…' is not allowed` otherwise
3. `await data.toBuffer()` — buffer the stream. The size limit is not checked here: `@fastify/multipart` is registered with `limits.fileSize = config.uploads.maxSizeMb` and rejects larger files (413) while streaming
4. Generate a storage folder name with `crypto.randomUUID()` (see _Storage keys_)
5. If `isProcessableImage(mimeType)`: `processImage(buffer)` → save the four WebP variants
6. Save the original
7. Insert the `uploads` row (`variants` JSONB for images, `null` otherwise; `uploadedBy` = session user)
8. `request.audit('create', 'uploads', upload.id, { originalName, mimeType, fileSize })`
9. Return `201` + upload object

## Allowed MIME types

Defined as `ALLOWED_MIME_TYPES` in `uploads-schema.ts`:

- **Images**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/avif`, `image/svg+xml`
- **Documents**: `application/pdf`, `application/msword`, `.docx`, `text/plain`, `.xls`, `.xlsx`
- **Audio**: `audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/aac`, `audio/flac`
- **Video**: `video/mp4`, `video/webm`, `video/ogg`, `video/quicktime`

## Storage keys

Storage keys live under a folder named by a random UUID generated in the route — **not** the upload's `id` (the row id is a uuidv7 assigned by the DB default). To find an upload's files, read `storageKey` and `variants.*.key` from its row; never derive paths from `id`.

```
<folder>/original.<ext>   ← always saved (extension from the uploaded filename)
<folder>/thumbnail.webp   ← processable images only
<folder>/small.webp
<folder>/medium.webp
<folder>/large.webp
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
  url: text                  // URL of the original file (see Serving files)
  variants: jsonb | null     // { thumbnail, small, medium, large } — each { key, url }
  uploadedBy: text | null    // FK → user.id, set null on user delete
  createdAt: timestamp
}
```

## Cascade deletion

`service.remove(id)`:
1. Fetches the upload record — returns `false` if missing
2. Deletes the DB row — returns `false` if a concurrent delete got there first
3. Deletes all storage keys — original + variant keys — best-effort (`Promise.allSettled`), after the row is gone, and returns `true`

The route answers 204 either way and audits only when `remove()` returned `true`.

Always call `service.remove()` instead of a raw DB delete when storage cleanup is needed.

## Image variants

`processImage(buffer, mimeType)` from `src/lib/image-processor.ts`:

| Variant | Dimensions | Format |
|---------|-----------|--------|
| `thumbnail` | 200×200 px (square crop) | WebP |
| `small` | 480px wide | WebP |
| `medium` | 960px wide | WebP |
| `large` | 1920px wide | WebP |

Only called when `isProcessableImage(mimeType)` — JPEG, PNG, GIF, WebP and AVIF (`IMAGE_MIME_TYPES` in the same file). SVG is excluded. Variants use `withoutEnlargement`, so small images are not upscaled.

## Adding uploads to another module

The `todos` module is the reference implementation for both shapes:

- **Multi-file** (`attachments: Upload[]`) — a junction table, steps 1–5 below.
- **Single file** (`file: Upload | null`) — a nullable `text` column `xxx.file_id` referencing `uploads.id` with `onDelete: 'set null'`; the response embeds `file: uploadSchema.nullable()`, create/update accept `fileId`; the service loads the upload by id on reads and deletes it on `remove`. Register the column in step 5.

Multi-file pattern:

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

Uploads are persisted immediately when the user selects a file — before the parent record exists. If the user abandons the form, those uploads become orphaned. A job in `src/server.ts` (`deleteOrphanUploads`, `src/lib/orphan-uploads.ts`) runs every `uploads.orphanCleanup.intervalHours` (default 6) and removes uploads older than `uploads.orphanCleanup.graceHours` (default 24) that no registered reference points to. Both live in `src/app.config.ts`. The job does not run at startup — only on the interval.

For the job to know which uploads are in use — and `GET /files/*` who may open their files (_Serving files_) — every column that references `uploads.id` must be registered in `src/config/upload-references.ts`, with `access` set to the guard of the record's `GET` route:

```ts
// src/config/upload-references.ts
import { eq, isNotNull } from 'drizzle-orm'
import { xxxAttachments, xxx } from '@/db/schema'
import { registerUploadReference, type UploadReaderAccess } from '@/lib/upload-references'

// GET /xxx/:id: requireSubscription('xxx') + requirePermission('xxx', 'view').
// `subscription: true` for requireSubscription() without a feature; omit it without one.
const XXX_READERS: UploadReaderAccess = { resource: 'xxx', action: 'view', subscription: 'xxx' }

// Junction table column (NOT NULL — no filter needed)
registerUploadReference({
  access: XXX_READERS,
  load: async (db) => {
    const rows = await db.selectDistinct({ id: xxxAttachments.uploadId }).from(xxxAttachments)
    return rows.map((r) => r.id)
  },
  references: async (db, uploadId) => {
    const rows = await db.select({ id: xxxAttachments.uploadId }).from(xxxAttachments)
      .where(eq(xxxAttachments.uploadId, uploadId)).limit(1)
    return rows.length > 0
  },
})

// Direct FK column (nullable — filter nulls)
registerUploadReference({
  access: XXX_READERS,
  load: async (db) => {
    const rows = await db.select({ id: xxx.fileId }).from(xxx).where(isNotNull(xxx.fileId))
    return rows.map((r) => r.id).filter((id): id is string => id !== null)
  },
  references: async (db, uploadId) => {
    const rows = await db.select({ id: xxx.id }).from(xxx).where(eq(xxx.fileId, uploadId)).limit(1)
    return rows.length > 0
  },
})
```

Add one `registerUploadReference` call per column. If a module's uploads are not registered, the job will treat them as orphaned and delete them after the grace period, and until then only their uploader and `uploads:view` can open their files.
