import { postUploads } from '@helix/api-client/hooks'
import type { Upload } from '@helix/api-client/types'

export async function uploadFile(file: File): Promise<Upload> {
  const formData = new FormData()
  formData.append('file', file)
  return postUploads({ data: formData as unknown })
}
