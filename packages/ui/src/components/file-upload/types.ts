export interface ImageVariant {
  key: string
  url: string
}

export interface ImageVariants {
  thumbnail: ImageVariant
  small: ImageVariant
  medium: ImageVariant
  large: ImageVariant
}

export interface UploadedFile {
  id: string
  originalName: string
  mimeType: string
  fileSize: number
  url: string
  variants: ImageVariants | null
}
