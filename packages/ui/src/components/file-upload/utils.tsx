import { IconFile, IconMusic, IconPhoto, IconVideo } from '@tabler/icons-react'

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <IconPhoto size={20} />
  if (mimeType.startsWith('audio/')) return <IconMusic size={20} />
  if (mimeType.startsWith('video/')) return <IconVideo size={20} />
  return <IconFile size={20} />
}
