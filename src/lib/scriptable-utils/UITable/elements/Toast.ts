import { getColor, getDynamicColor } from '../../colors'
import { isNumber } from '../../common'
import { getGrid, Grid } from '../grid'
import Div, { NonCascadingDiv } from './Div'
import Gradient from './Gradient'
import HSpace from './HSpace'
import Icon, { IconOrSFKey } from './Icon'
import P from './P'
import presetStyles, { FlavorKey } from './presetStyles'
import Span from './Span'
import { TapProps } from './types'

type ToastGrid = Grid<'metadata' | 'metadataIcon' | 'leftIcon' | 'leftIconSpacing'>

const toastGrid: ToastGrid = getGrid({
  metadata: '15%',
  metadataIcon: '8%',
  leftIcon: '10%',
  leftIconSpacing: '3%',
})

export type ToastProps = {
  title: string
  icon: IconOrSFKey
  flavor?: FlavorKey
  metadata?: number | string
  showCloseIcon?: boolean
  description?: string
  grid?: ToastGrid
} & TapProps

/** Flavors that shouldn't be used for the left icon's accent color, as they
 * blend too much with the background. */
const BANNED_ICON_COLOR_FLAVORS: FlavorKey[] = ['secondary', 'warning']

export default ({
  icon,
  title,
  showCloseIcon,
  flavor = 'secondary',
  metadata,
  description,
  grid = toastGrid,
  ...tapProps
}: ToastProps) => {
  const accentColor = presetStyles().flavors[flavor].bgColor

  const colorRibbon = Div([], { bgColor: accentColor, height: 4 })

  const mainRowRightIcons = Span(
    [
      (metadata || isNumber(metadata)) && P(String(metadata), { align: 'center', width: grid.metadata }),
      showCloseIcon && Icon('x_in_circle', { width: grid.metadataIcon }),
    ],
    { font: () => Font.footnote(), align: 'center', isFaded: true },
  )

  const mainRow = Div([
    Icon(icon, {
      width: grid.leftIcon,
      ...(!BANNED_ICON_COLOR_FLAVORS.includes(flavor) && {
        color: accentColor,
      }),
    }),
    HSpace(grid.leftIconSpacing),
    P(title),
    mainRowRightIcons,
  ])

  const descriptionRow =
    description &&
    Div([HSpace('10%'), P(description, { font: () => Font.footnote() })], {
      height: 14,
    })

  const contents = Div([Div([mainRow, descriptionRow], { paddingTop: 0, paddingBottom: 0 })], {
    paddingTop: description ? 5 : 14,
    paddingBottom: description ? 10 : 15,
    bgColor: getDynamicColor('bg', 'gray8'),
  })

  const el = NonCascadingDiv(
    [
      colorRibbon,
      contents,
      Gradient({
        from: getColor('selectedBgColor'),
        mode: 'DOWN',
        stepOptions: { numShownSteps: 5, stepRowHeight: 2 },
      }),
    ],
    {
      marginTop: 6,
      marginBottom: 6,
      ...tapProps,
    },
  )
  el.setDescription('TOAST')
  return el
}
