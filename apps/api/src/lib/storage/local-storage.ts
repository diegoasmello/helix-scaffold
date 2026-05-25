import fs from 'node:fs/promises'
import path from 'node:path'

import type { StorageProvider } from './types'

export class LocalStorageProvider implements StorageProvider {
  constructor(
    private readonly uploadDir: string,
    private readonly baseUrl: string
  ) {}

  async save(key: string, buffer: Buffer, _mimeType: string): Promise<void> {
    const filePath = path.join(this.uploadDir, key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, buffer)
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.uploadDir, key)
    await fs.rm(filePath, { force: true })
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/files/${key}`
  }
}
