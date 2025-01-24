import { getColor, getDynamicColor } from '../../colors'
import { BGColorMode, SizeMap } from './types'

export const paddingSizeToNumMap: SizeMap = { sm: 5, md: 10, lg: 15 }

export const textSizeToNumMap: SizeMap = { sm: 16, md: 20, lg: 22 }

export const rowHeightSizeToNumMap: SizeMap = { sm: '4%', md: '5%', lg: '7%' }

export const bgColorModeToColor: Record<BGColorMode, Color> = {
  selected: getDynamicColor('gray1', 'gray7'),
  callout: getColor('secondaryTextColor'),
}

export const DEFAULT_GRID_WIDTH = 12
export const DEFAULT_LEFT_GUTTER_WIDTH = 1
export const DEFAULT_RIGHT_GUTTER_WIDTH = 2
