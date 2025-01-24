import { MapFn } from '../../types/utilTypes'

import type { StaticFontLabel } from './fonts'

export type FontGetter = MapFn<number, Font>

export type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900

export const fontFamilyNames = <const>['System', 'Monospaced', 'Rounded']

export type FontFamilyName = (typeof fontFamilyNames)[number]

export type FontFamily = Record<FontWeight, FontGetter>

export type FontFamilySelection = FontFamilyName | StaticFontLabel | 'Italic'
