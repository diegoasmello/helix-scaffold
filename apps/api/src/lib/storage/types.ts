export interface StorageProvider {
  save(key: string, buffer: Buffer, mimeType: string): Promise<void>
  delete(key: string): Promise<void>
  getUrl(key: string): string
}
