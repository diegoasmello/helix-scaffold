import type { ResolvedAppConfig } from '../../config'
import { createLocalStorageProvider } from './local-storage'
import type { StorageProvider } from './types'

export type { StorageProvider }

export function createStorageProvider(
  uploads: Pick<ResolvedAppConfig['uploads'], 'storage' | 'dir'>,
  baseUrl: string
): StorageProvider {
  if (uploads.storage === 's3') {
    throw new Error('S3 storage provider is not yet implemented')
  }
  return createLocalStorageProvider(uploads.dir, baseUrl)
}
