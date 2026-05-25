# uploads module — frontend

Thin service module. Contains only `uploadFile` — the single function that wraps `POST /uploads` for use across the app.

## `uploadFile`

```ts
import { uploadFile } from '@/modules/uploads/service'
```

Sends a `multipart/form-data` request to `POST /uploads` and returns a fully typed `Upload` object from `@helix/api-client/types`. Pass it directly as the `onUpload` prop to `FilesInput` or `FileInput`.

```ts
export async function uploadFile(file: File): Promise<Upload> {
  const formData = new FormData()
  formData.append('file', file)
  return postUploads({ data: formData as unknown })
}
```

## Usage

```tsx
import { FilesInput } from '@helix/ui'
import { uploadFile } from '@/modules/uploads/service'

<FilesInput
  label="Attachments"
  value={form.values.attachments}
  onChange={(uploads) => form.setFieldValue('attachments', uploads)}
  onUpload={uploadFile}
  maxFiles={10}
/>
```

See `apps/web/CLAUDE.md` → _File uploads_ for the complete pattern including single-file fields and detail screen rendering.
