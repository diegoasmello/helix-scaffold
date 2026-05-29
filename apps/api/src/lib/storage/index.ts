import type { env } from '../../env'
import { createLocalStorageProvider } from './local-storage'
import type { StorageProvider } from './types'

export type { StorageProvider }

export function createStorageProvider(
  config: Pick<
    typeof env,
    'STORAGE_PROVIDER' | 'UPLOAD_DIR' | 'UPLOAD_BASE_URL'
  >
): StorageProvider {
  if (config.STORAGE_PROVIDER === 's3') {
    throw new Error('S3 storage provider is not yet implemented')
  }
  return createLocalStorageProvider(config.UPLOAD_DIR, config.UPLOAD_BASE_URL)
}
