import { chunk } from './array'
import { isString, objectFromEntries } from './common'
import { shortSwitch } from './flow'
import { hasKey, objectKeys, range } from './object'
import { Domain, Omit_ } from './types/utilTypes'

type EnhancedColorConstructorOpts = {
  label: string
  lightColor?: Color
  darkColor?: Color
  staticColor?: Color
}

export class EnhancedColor {
  label: string
  isDynamic: boolean
  private colorObj: Partial<{ light: Color; dark: Color; static: Color }>

  constructor({ label, lightColor, darkColor, staticColor }: EnhancedColorConstructorOpts) {
    this.label = label
    this.isDynamic = Boolean(lightColor && darkColor)
    if (!(staticColor || this.isDynamic)) {
      throw new Error(`Color ${label}: must provide more color data`)
    }
    this.colorObj = { light: lightColor, dark: darkColor, static: staticColor }
  }

  get color() {
    return this.isDynamic ? Color.dynamic(this.lightColor, this.colorObj.dark!) : this.colorObj.static!
  }

  get lightColor() {
    return (this.colorObj.light || this.colorObj.static)!
  }

  get darkColor() {
    return (this.colorObj.dark || this.colorObj.static)!
  }
}

const c = ([hex]: TemplateStringsArray) => new Color(hex!)

const isEnhancedColor = (val: Color | EnhancedColor): val is EnhancedColor => val instanceof EnhancedColor

const COLORS = {
  white: c`ffffff`,
  black: c`000000`,

  grayMinus3: c`fdfdfd`,
  grayMinus2: c`fcfcfc`,
  grayMinus1: c`fbfbfb`,
  gray0: c`efefef`,
  gray1: c`d8d8d8`,
  gray2: c`c2c2c2`,
  gray3: c`adadad`,
  gray4: c`979797`,
  gray5: c`6c6c6c`,
  gray6: c`414141`,
  gray7: c`2b2b2b`,
  gray8: c`161616`,

  // Naming convention:
  //  {color}_d1 = a darker shade by degree 1
  //  {color}_l1 = a lighter shade by degree 1
  // https://coolors.co/253031-315659-2978a0-bcab79-c6e0ff

  red_l4: c`e3949e`,
  red_l3: c`da717e`,
  red_l2: c`d14d5e`,
  red_l1: c`c33245`,
  red: c`a12a3a`,
  red_d1: c`82212e`,
  red_d2: c`611923`,

  yellow_l3: c`eae5d6`,
  yellow_l2: c`ddd4bb`,
  yellow_l1: c`cfc3a0`,
  yellow: c`bcab79`,
  yellow_d1: c`b4a16a`,
  yellow_d2: c`a38f52`,

  dark_green_l2: c`4f6769`,
  dark_green_l1: c`3d5051`,
  dark_green: c`253031`,
  dark_green_d1: c`1a2223`,
  dark_green_d2: c`121717`,

  green_l4: c`96babd`,
  green_l3: c`73a3a7`,
  green_l2: c`508c91`,
  green_l1: c`417376`,
  green: c`315659`,
  green_d1: c`244042`,
  green_d2: c`162627`,

  deep_blue_l2: c`4da5d1`,
  deep_blue_l1: c`3292c3`,
  deep_blue: c`2978a0`,
  deep_blue_d1: c`216282`,
  deep_blue_d2: c`194961`,

  blue_l1: c`ebf4ff`,
  blue: c`c6e0ff`,
  blue_d1: c`add2ff`,
  blue_d2: c`85bcff`,

  // RANDOM COLORS I LIKE
  // Named by coolors.co

  // Nice dusky gray, good for dark mode
  umber: c`695958`,
  black_coffee: c`41393e`,
  alice_blue: c`e4f0ff`,
  black_coral: c`4b5463`,
  platinum: c`e6e8e9`,
  majorelle_blue: c`4f46e5`,
  neon_blue: c`6366f1`,
  magnolia: c`f2f1fd`,
  ocean_blue: c`4339ca`,

  // TAILWIND COLORS
  slate_100: c`f1f5f9`,
  slate_700: c`334155`,
  sky_500: c`0ea5e9`,
  red_500: c`ef4444`,

  // BULMA COLORS (another UI framework)
  caribbean_green: c`00d1b2`,
  jasmine: c`ffe08a`,
  field_drab: c`574a2b`,
}

const COLOR_ALIASES = {
  domain_personal: COLORS.sky_500,
  domain_work: COLORS.red_500,
  danger: COLORS.red_500,
  success: COLORS.caribbean_green,
  warning: COLORS.jasmine,
  bg: new EnhancedColor({
    label: 'bg',
    lightColor: COLORS.white,
    darkColor: c`1c1c1e`,
  }),
  primaryTextColor: new EnhancedColor({
    label: 'primaryTextColor',
    lightColor: COLORS.gray8,
    darkColor: COLORS.gray1,
  }),
  secondaryTextColor: new EnhancedColor({
    label: 'secondaryTextColor',
    lightColor: COLORS.gray5,
    darkColor: COLORS.gray4,
  }),
  hr: new EnhancedColor({
    label: 'hr',
    lightColor: COLORS.gray0,
    darkColor: COLORS.gray7,
  }),
  selectedBgColor: new EnhancedColor({
    label: 'selectedBgColor',
    lightColor: COLORS.gray1,
    darkColor: COLORS.gray6,
  }),
}

export const colorKeys = [...objectKeys(COLORS), ...objectKeys(COLOR_ALIASES)]

export type ColorKey = (typeof colorKeys)[number]

const getKeyVal = (key: ColorKey) => {
  if (hasKey(COLORS, key)) return COLORS[key]
  if (hasKey(COLOR_ALIASES, key)) return COLOR_ALIASES[key]
  throw new Error(`No color found for key ${String(key)}`)
}

export const getColor = (key: ColorKey) => {
  const val = getKeyVal(key)
  return isEnhancedColor(val) ? val.color : val
}

export const getDynamicColor = (lightColorOrKey: ColorKey | Color, darkColorOrKey: ColorKey | Color) => {
  const lightColor = isString(lightColorOrKey) ? getColor(lightColorOrKey) : lightColorOrKey
  const darkColor = isString(darkColorOrKey) ? getColor(darkColorOrKey) : darkColorOrKey
  return Color.dynamic(lightColor, darkColor)
}

export const getColors = () => objectFromEntries(colorKeys.map((key) => [key, getColor(key)]))

export const getEnhancedColor = (keyOrColor: ColorKey | Color): EnhancedColor => {
  const val = isString(keyOrColor) ? getKeyVal(keyOrColor) : keyOrColor
  return isEnhancedColor(val)
    ? val
    : new EnhancedColor({
        label: isString(keyOrColor) ? keyOrColor : UUID.string(),
        staticColor: val,
      })
}

export const getDomainColor = (domain: Domain) =>
  shortSwitch(domain, {
    personal: getColor('domain_personal'),
    work: getColor('domain_work'),
  })

type FormattedHex = { r: string; g: string; b: string }
const formatHex = (hexStr: string): FormattedHex => {
  if (hexStr.length !== 6) throw new Error('Must be 6 chars')
  const [r, g, b] = chunk([...hexStr], 2)
  return { r: r!.join(''), g: g!.join(''), b: b!.join('') }
}

type FormattedInt = { r: number; g: number; b: number }
const formattedHexToInt = ({ r, g, b }: FormattedHex): FormattedInt => ({
  r: Number.parseInt(r, 16),
  g: Number.parseInt(g, 16),
  b: Number.parseInt(b, 16),
})

const intToHex = (int: number): string => Math.round(int).toString(16).padStart(2, '0')

const formattedHexToColor = ({ r, g, b }: FormattedHex) => new Color([r, g, b].join(''))

const hexOrColorToHex = (val: string | Color) => (isString(val) ? val : val.hex)

type GetColorFadeMidpointsOpts<N extends number> = {
  from: string | Color
  to: string | Color
  numPoints: N
}

type GetColorFadeMidpoints = {
  (opts: GetColorFadeMidpointsOpts<1>): [Color]
  (opts: GetColorFadeMidpointsOpts<2>): [Color, Color]
  (opts: GetColorFadeMidpointsOpts<3>): [Color, Color, Color]
  (opts: GetColorFadeMidpointsOpts<4>): [Color, Color, Color, Color]
  (opts: GetColorFadeMidpointsOpts<5>): [Color, Color, Color, Color, Color]
  (
    opts: Omit_<GetColorFadeMidpointsOpts<any>, 'numPoints'> & {
      numPoints: number
    },
  ): Color[]
}

/**
 * Inspired by https://stackoverflow.com/a/52306228
 *
 * Generates `numPoints` number of midpoints between `from` and `to` colors.
 * Returned colors are exclusive of `from` and `to`.
 */
export const getGradientMidpoints: GetColorFadeMidpoints = ({ from, to, numPoints }): any => {
  const fromInt = formattedHexToInt(formatHex(hexOrColorToHex(from)))
  const toInt = formattedHexToInt(formatHex(hexOrColorToHex(to)))
  const stepPercent = 1 / (numPoints + 1)
  const intPoints = range(1, numPoints).map((stepMultiplier) => ({
    r: fromInt.r + stepPercent * stepMultiplier * (toInt.r - fromInt.r),
    g: fromInt.g + stepPercent * stepMultiplier * (toInt.g - fromInt.g),
    b: fromInt.b + stepPercent * stepMultiplier * (toInt.b - fromInt.b),
  }))
  return intPoints.map(({ r, g, b }) =>
    formattedHexToColor({
      r: intToHex(Math.floor(r)),
      g: intToHex(Math.floor(g)),
      b: intToHex(Math.floor(b)),
    }),
  )
}

/** Get the color halfway between the 2 colors */
export const fadeIntoColor = (color: Color, colorFadingInto: Color) =>
  getGradientMidpoints({ from: color, to: colorFadingInto, numPoints: 1 })[0]
