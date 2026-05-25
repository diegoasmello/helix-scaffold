import sharp from 'sharp'

export const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
])

// SVGs are stored as-is — no rasterization
export function isProcessableImage(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.has(mimeType)
}

export interface ImageVariantBuffers {
  thumbnail: Buffer
  small: Buffer
  medium: Buffer
  large: Buffer
}

export async function processImage(
  inputBuffer: Buffer
): Promise<ImageVariantBuffers> {
  const [thumbnail, small, medium, large] = await Promise.all([
    sharp(inputBuffer)
      .resize(200, 200, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer(),
    sharp(inputBuffer)
      .resize(480, undefined, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer(),
    sharp(inputBuffer)
      .resize(960, undefined, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer(),
    sharp(inputBuffer)
      .resize(1920, undefined, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer(),
  ])
  return { thumbnail, small, medium, large }
}
