import symbolsMap from './sfSymbolsMap'

export type SFSymbolKey = keyof typeof symbolsMap

/** Format: `${symbolKey}-${colorHex}` */
export type TintRequestKey = string

export type LightDarkKey = 'light' | 'dark'
