import { objectKeys } from '../../object'
import { FontFamily, FontFamilyName, FontGetter, FontWeight } from './types'

const staticFonts = {
  largeTitle: () => Font.largeTitle(),
  title1: () => Font.title1(),
  title2: () => Font.title2(),
  title3: () => Font.title3(),
  headline: () => Font.headline(),
  subheadline: () => Font.subheadline(),
  body: () => Font.body(),
  callout: () => Font.callout(),
  footnote: () => Font.footnote(),
  caption1: () => Font.caption1(),
  caption2: () => Font.caption2(),
}

export const STATIC_FONT_LABELS = objectKeys(staticFonts)

export type StaticFontLabel = (typeof STATIC_FONT_LABELS)[number]

const systemFont: FontFamily = {
  100: (n) => Font.ultraLightSystemFont(n),
  200: (n) => Font.thinSystemFont(n),
  300: (n) => Font.lightSystemFont(n),
  400: (n) => Font.regularSystemFont(n),
  500: (n) => Font.mediumSystemFont(n),
  600: (n) => Font.semiboldSystemFont(n),
  700: (n) => Font.boldSystemFont(n),
  800: (n) => Font.heavySystemFont(n),
  900: (n) => Font.blackSystemFont(n),
}

const monospacedFont: FontFamily = {
  100: (n) => Font.ultraLightMonospacedSystemFont(n),
  200: (n) => Font.thinMonospacedSystemFont(n),
  300: (n) => Font.lightMonospacedSystemFont(n),
  400: (n) => Font.regularMonospacedSystemFont(n),
  500: (n) => Font.mediumMonospacedSystemFont(n),
  600: (n) => Font.semiboldMonospacedSystemFont(n),
  700: (n) => Font.boldMonospacedSystemFont(n),
  800: (n) => Font.heavyMonospacedSystemFont(n),
  900: (n) => Font.blackMonospacedSystemFont(n),
}

const roundedFont: FontFamily = {
  100: (n) => Font.ultraLightRoundedSystemFont(n),
  200: (n) => Font.thinRoundedSystemFont(n),
  300: (n) => Font.lightRoundedSystemFont(n),
  400: (n) => Font.regularRoundedSystemFont(n),
  500: (n) => Font.mediumRoundedSystemFont(n),
  600: (n) => Font.semiboldRoundedSystemFont(n),
  700: (n) => Font.boldRoundedSystemFont(n),
  800: (n) => Font.heavyRoundedSystemFont(n),
  900: (n) => Font.blackRoundedSystemFont(n),
}

const fontFamilies: Record<FontFamilyName, FontFamily> = {
  System: systemFont,
  Monospaced: monospacedFont,
  Rounded: roundedFont,
}

//

type SharedGetFontFamilyOpts = { family: FontFamilyName; weight?: FontWeight }

type GetFontFamily = {
  (opts: SharedGetFontFamilyOpts & { size: number }): Font
  (opts: SharedGetFontFamilyOpts & { size?: number }): FontGetter
}

export const getFontFamily: GetFontFamily = ({ family, size, weight = 400 }): any => {
  const fontGetter = fontFamilies[family][weight]
  return size ? fontGetter(size) : fontGetter
}

type GetItalicFont = {
  (size: number): Font
  (size?: number): FontGetter
}

/** This font is sort of unique in that it has no weight variations, but can
 * vary in size. */
export const getItalicFont: GetItalicFont = (size): any =>
  size ? Font.italicSystemFont(size) : (n: number) => Font.italicSystemFont(n)

export const getStaticFont = (fontLabel: StaticFontLabel) => staticFonts[fontLabel]
