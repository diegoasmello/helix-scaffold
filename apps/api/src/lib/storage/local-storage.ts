import fs from 'node:fs/promises'
import path from 'node:path'

import { API_PREFIX } from '@/lib/api-prefix'

import type { StorageProvider } from './types'

export function createLocalStorageProvider(
  uploadDir: string,
  baseUrl: string
): StorageProvider {
  async function save(key: string, buffer: Buffer): Promise<void> {
    const filePath = path.join(uploadDir, key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, buffer)
  }

  async function deleteFile(key: string): Promise<void> {
    const filePath = path.join(uploadDir, key)
    await fs.rm(filePath, { force: true })
  }

  function getUrl(key: string): string {
    return `${baseUrl}${API_PREFIX}/files/${key}`
  }

  return { save, delete: deleteFile, getUrl }
}
