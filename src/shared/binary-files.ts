const IMAGE_EXTENSIONS: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml'
}

const OTHER_BINARY_EXTENSIONS = new Set([
  'pdf',
  'zip',
  'tar',
  'gz',
  '7z',
  'rar',
  'woff',
  'woff2',
  'ttf',
  'otf',
  'eot',
  'mp3',
  'mp4',
  'wav',
  'ogg',
  'mov',
  'avi',
  'exe',
  'dll',
  'so',
  'dylib',
  'node',
  'wasm',
  'db',
  'sqlite'
])

function extOf(relPath: string): string {
  const name = relPath.split('/').pop() ?? relPath
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

/** MIME type for a known image extension, or null if the path isn't a recognized image. */
export function imageMimeType(relPath: string): string | null {
  return IMAGE_EXTENSIONS[extOf(relPath)] ?? null
}

export function isImagePath(relPath: string): boolean {
  return imageMimeType(relPath) !== null
}

/** True for any file type whose content shouldn't be decoded/rendered as text (images included). */
export function isBinaryPath(relPath: string): boolean {
  const ext = extOf(relPath)
  return ext in IMAGE_EXTENSIONS || OTHER_BINARY_EXTENSIONS.has(ext)
}
