import { isString } from '../../common'
import { ScreenHeightMeasurements } from '../../configRegister'
import { getMaxScreenHeight } from '../../device'
import { paddingSizeToNumMap, rowHeightSizeToNumMap } from './consts'
import { ParsedPaddingOpts, Percent, RowOpts, RowSize, SizeMap } from './types'

const isPercent = (val: any): val is Percent => isString(val) && val.includes('%')

const isRowSize = (val: any): val is RowSize =>
  isString(val) && (['lg', 'md', 'sm'] as RowSize[]).includes(val as RowSize)

const heightPercentToNumber = (percent: Percent, mode: ScreenHeightMeasurements.Mode = 'notFullscreen') => {
  const numberStr = percent.split('%')[0]
  if (!numberStr) {
    throw new Error(`Incorrectly formatted percent value: ${percent}`)
  }
  const number = Number.parseInt(numberStr, 10)
  if (number < 1 || number > 100) {
    throw new Error(`Percent value must be between 1-100: ${percent}`)
  }
  const fraction = number / 100
  return Math.floor(fraction * getMaxScreenHeight(mode))
}

export const parseSizeValue = (
  value: number | RowSize | Percent,
  lookupMap: SizeMap,
  mode?: ScreenHeightMeasurements.Mode,
): number => {
  const mappedValue = isRowSize(value) ? lookupMap[value] : value
  return isPercent(mappedValue) ? heightPercentToNumber(mappedValue, mode) : mappedValue
}

const parsePaddingOpts = (padding: RowOpts['padding']): ParsedPaddingOpts => {
  const paddingTop = parseSizeValue(padding?.paddingTop ?? 'sm', paddingSizeToNumMap)
  const paddingBottom = parseSizeValue(padding?.paddingBottom ?? 'sm', paddingSizeToNumMap)
  return { paddingTop, paddingBottom }
}

export type HeightOpts = Pick<RowOpts, 'padding' | 'rowHeight' | 'mode'>
export const parseHeightVals = ({ padding, rowHeight = 'sm', mode }: HeightOpts) => ({
  padding: parsePaddingOpts(padding),
  rowHeight: parseSizeValue(rowHeight, rowHeightSizeToNumMap, mode),
})
