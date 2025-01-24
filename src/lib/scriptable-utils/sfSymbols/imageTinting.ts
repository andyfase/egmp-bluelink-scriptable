import { getColor } from '../colors'
import symbolsMap from './sfSymbolsMap'
import { SFSymbolKey } from './types'

const getUntintedImage = (key: SFSymbolKey) => {
  const symbol = SFSymbol.named(symbolsMap[key])

  if (!symbol) {
    throw new Error(`Invalid SFSymbol key: ${key}`)
  }
  /** Make it a bit bigger so it's high-def enough to scale up. */
  symbol.applyFont(Font.systemFont(53))
  symbol.applyThinWeight()
  return symbol.image
}

export const getSfSymbolImg = (key: SFSymbolKey, color: Color | null = getColor('primaryTextColor')) => {
  const untintedImg = getUntintedImage(key)
  if (!color) return untintedImg

  // todo need to add in async tinting to this.
  return untintedImg
}
