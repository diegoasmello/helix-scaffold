import { createUpload } from '@helix/api-client/mocks'
import { describe, expect, it, vi } from 'vitest'

import { uploadFile } from './service'

// jsdom's File cannot cross Node's fetch inside a FormData, so the request
// itself is left to the E2E suite (a module spec uploading its files); this
// checks what the service adds: the multipart field the API reads (`file`).
const { mockPostUploads } = vi.hoisted(() => ({ mockPostUploads: vi.fn() }))

vi.mock('@helix/api-client/hooks', () => ({ postUploads: mockPostUploads }))

describe('uploadFile', () => {
  it('sends the file in the `file` field and returns the upload', async () => {
    const upload = createUpload({ id: 'upload-1' })
    mockPostUploads.mockResolvedValue(upload)
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })

    await expect(uploadFile(file)).resolves.toBe(upload)

    const { data } = mockPostUploads.mock.calls[0][0] as { data: FormData }
    expect(data).toBeInstanceOf(FormData)
    expect(data.get('file')).toBe(file)
  })
})
