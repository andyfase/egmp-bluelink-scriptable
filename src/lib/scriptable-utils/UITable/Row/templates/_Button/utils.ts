import { getRowHeight } from '../..'
import { DEFAULT_HR_HEIGHT } from '../_HR'
import { getSizeConfig } from './consts'
import { _INTERNAL_ButtonOpts } from './types'

type GetButtonHeightOpts = {
  numBorders: 0 | 1 | 2
} & Pick<_INTERNAL_ButtonOpts, 'isSmall' | 'isLarge'>
/** Used for UI layout purposes. */
export const getButtonHeight = ({ isLarge, isSmall, numBorders }: GetButtonHeightOpts) => {
  const sizeConfig = getSizeConfig({ isLarge, isSmall })
  const rowWithPaddingHeight = getRowHeight({
    padding: {
      paddingTop: sizeConfig.padding,
      paddingBottom: sizeConfig.padding,
    },
    rowHeight: sizeConfig.rowHeight,
  })
  return rowWithPaddingHeight + numBorders * DEFAULT_HR_HEIGHT
}
