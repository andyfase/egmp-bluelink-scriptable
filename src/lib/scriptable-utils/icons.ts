export const ICONS = {
  ADD: '⨁',
  ARROW_DOWN: '↓',
  ARROW_RIGHT: '→',
  ARROW_UP: '↑',
  BLOCK: '█',
  CANCEL: 'ⓧ',
  CHECKMARK_GREEN: '✅',
  CHEVRON_LEFT: '‹',
  CHEVRON_RIGHT: '›',
  ELLIPSIS: '…',
  FOLDER: '📁',
  HEART: '❤️',
  MAGNIFYING_GLASS: '🔍',
  NEST_ARROW: '↳',
  OPEN_EXTERNAL: ' ↗',
  PAPERCLIP: '📎',
  PENCIL: '✐',
  STAR: '✭',
  VERTICAL_ELLIPSIS: '⋮',
  PLUS: '+',
  MINUS: '-',
}

export type IconKey = keyof typeof ICONS

const iconKeySet = new Set(Object.keys(ICONS))

export const isIconKey = (str: string): str is IconKey => iconKeySet.has(str)
