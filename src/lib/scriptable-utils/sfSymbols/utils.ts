import { KEY_SEPARATOR } from './consts'
import sfSymbolsMap from './sfSymbolsMap'
import { SFSymbolKey, TintRequestKey } from './types'

export const getTintRequestKey = (iconKey: SFSymbolKey, colorHex: string): TintRequestKey =>
  `${iconKey}${KEY_SEPARATOR}${colorHex}`

export const parseTintRequestKey = (key: TintRequestKey) => {
  const [iconKey, colorHex] = key.split(KEY_SEPARATOR)
  return { iconKey: iconKey as SFSymbolKey, color: new Color(colorHex!) }
}

const sfSymbolKeySet = new Set(Object.keys(sfSymbolsMap))
export const isSFSymbolKey = (key: string): key is SFSymbolKey => sfSymbolKeySet.has(key)
