import { isImagePath } from '../../shared/binary-files'

export interface FileIconSpec {
  glyph: string
  colorVar: string
}

const LOCKFILE_NAMES = new Set(['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'composer.lock', 'Cargo.lock'])

const EXT_ICONS: Record<string, FileIconSpec> = {
  ts: { glyph: 'TS', colorVar: '--accent' },
  tsx: { glyph: 'TS', colorVar: '--accent' },
  js: { glyph: 'JS', colorVar: '--warning' },
  jsx: { glyph: 'JS', colorVar: '--warning' },
  mjs: { glyph: 'JS', colorVar: '--warning' },
  cjs: { glyph: 'JS', colorVar: '--warning' },
  json: { glyph: '{}', colorVar: '--text-dim' },
  jsonc: { glyph: '{}', colorVar: '--text-dim' },
  md: { glyph: 'M↓', colorVar: '--text-dim' },
  mdx: { glyph: 'M↓', colorVar: '--text-dim' },
  html: { glyph: '<>', colorVar: '--danger' },
  htm: { glyph: '<>', colorVar: '--danger' },
  css: { glyph: '#', colorVar: '--accent' },
  scss: { glyph: '#', colorVar: '--accent' },
  sass: { glyph: '#', colorVar: '--accent' },
  less: { glyph: '#', colorVar: '--accent' },
  yml: { glyph: 'Y', colorVar: '--success' },
  yaml: { glyph: 'Y', colorVar: '--success' },
  toml: { glyph: '⚙', colorVar: '--text-faint' },
  ini: { glyph: '⚙', colorVar: '--text-faint' },
  env: { glyph: '⚙', colorVar: '--text-faint' },
  sh: { glyph: '$', colorVar: '--success' },
  bash: { glyph: '$', colorVar: '--success' },
  zsh: { glyph: '$', colorVar: '--success' },
  ps1: { glyph: '$', colorVar: '--success' },
  py: { glyph: 'PY', colorVar: '--warning' },
  rb: { glyph: 'RB', colorVar: '--danger' },
  go: { glyph: 'GO', colorVar: '--accent' },
  rs: { glyph: 'RS', colorVar: '--danger' },
  java: { glyph: 'J', colorVar: '--danger' },
  kt: { glyph: 'K', colorVar: '--warning' },
  c: { glyph: 'C', colorVar: '--accent' },
  h: { glyph: 'C', colorVar: '--accent' },
  cpp: { glyph: 'C+', colorVar: '--accent' },
  hpp: { glyph: 'C+', colorVar: '--accent' },
  cs: { glyph: 'C#', colorVar: '--accent' },
  txt: { glyph: 'TXT', colorVar: '--text-faint' },
  csv: { glyph: '▤', colorVar: '--success' },
  sql: { glyph: 'DB', colorVar: '--accent' },
  lock: { glyph: '🔒', colorVar: '--text-faint' }
}

const IMAGE_ICON: FileIconSpec = { glyph: '◪', colorVar: '--success' }
const DEFAULT_ICON: FileIconSpec = { glyph: '•', colorVar: '--text-faint' }

export function fileIconFor(name: string): FileIconSpec {
  if (isImagePath(name)) return IMAGE_ICON
  if (LOCKFILE_NAMES.has(name)) return { glyph: '🔒', colorVar: '--text-faint' }

  const dot = name.lastIndexOf('.')
  const ext = dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
  return EXT_ICONS[ext] ?? DEFAULT_ICON
}
