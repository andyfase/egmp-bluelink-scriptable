import { getColor } from '../../../../colors'
import { ICONS } from '../../../../icons'
import { NoParamFn } from '../../../../types/utilTypes'
import { DEFAULT_GRID_WIDTH } from '../../consts'
import { ContentAreaOpts, RowSize } from '../../types'
import _Spacer from '../_Spacer'
import { CycleTabsOpts } from './types'

const FADED_COLOR = getColor('green_l2')
const COMBINED_ARROW_WIDTH = 2

type Data<T> = [normal: T, subtle: T]
type StyleLookup = {
  underlineChar: Data<string>
  underlineCharRepeat: Data<number>
  textSize: Data<RowSize>
  rowHeight: Data<number>
  underlineRowHeight: Data<number>
}

const styleLookup: StyleLookup = {
  underlineChar: [ICONS.BLOCK, '–'],
  underlineCharRepeat: [5, 7],
  textSize: ['md', 'sm'],
  rowHeight: [24, 20],
  underlineRowHeight: [20, 2],
}

export const getStyle = <K extends keyof StyleLookup>(key: K, subtle: boolean): StyleLookup[K][0] =>
  styleLookup[key][subtle ? 1 : 0]

const getTabWidth = (maxPerPage: number) => Math.floor((DEFAULT_GRID_WIDTH - COMBINED_ARROW_WIDTH) / maxPerPage)

//

type LabelCellOpts<T extends string> = Pick<CycleTabsOpts<T>, 'mapLabel'> & {
  label: T
  isActive: boolean
  subtle: boolean
  tabWidth: number
}
const LabelCell = <T extends string>({
  mapLabel,
  subtle,
  label,
  isActive,
  tabWidth,
}: LabelCellOpts<T>): ContentAreaOpts => ({
  text: mapLabel?.(label) ?? label,
  align: 'left',
  ...(!isActive && { color: FADED_COLOR }),
  width: tabWidth,
  textSize: getStyle('textSize', subtle),
})

export const UnderlineCell = (isActive: boolean, subtle: boolean, maxPerPage: number): ContentAreaOpts => {
  const tabWidth = getTabWidth(maxPerPage)
  return isActive
    ? {
        text: getStyle('underlineChar', subtle).repeat(getStyle('underlineCharRepeat', subtle)),
        color: getColor('deep_blue_l1'),
        align: 'left',
        width: tabWidth,
      }
    : { isEmpty: true, width: tabWidth }
}

const ArrowCell = (text: string): ContentAreaOpts => ({
  text,
  align: 'center',
  color: FADED_COLOR,
})

export const BackCyclingSpacer = (onTap: NoParamFn) => _Spacer({ onTap })

export const ScrollLeftIndicator = () => ArrowCell(ICONS.CHEVRON_LEFT)
export const ScrollRightIndicator = () => ArrowCell(ICONS.CHEVRON_RIGHT)

export const Tab = (
  label: string,
  maxPerPage: number,
  { mapLabel, initValue, subtle = false }: Pick<CycleTabsOpts<any>, 'mapLabel' | 'initValue' | 'subtle'>,
) =>
  LabelCell({
    mapLabel,
    label,
    isActive: label === initValue,
    subtle,
    tabWidth: getTabWidth(maxPerPage),
  })
