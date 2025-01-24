import { getDynamicColor } from '../../colors'
import { clamp } from '../../common'
import { range } from '../../object'
import Div, { DivStyle } from './Div'
import P from './P'
import presetStyles from './presetStyles'

const FONT_SIZE = 10
const PROGRESS_ICON = '█'
const NUM_CELLS = 50

const INCOMPLETE_COLOR = getDynamicColor('gray0', 'gray1')

type CellOpts = { isComplete: boolean; completeColor: Color }
const cell = ({ isComplete, completeColor }: CellOpts) =>
  P(PROGRESS_ICON, {
    color: isComplete ? completeColor : INCOMPLETE_COLOR,
    font: (n) => Font.ultraLightSystemFont(n),
    fontSize: 10,
  })

type OtherOpts = DivStyle & { completeColor?: Color }

/** Progress must be a percentage value between 0 and 1 */
export default (
  progress: number,
  { completeColor = presetStyles().flavors.primary.bgColor!, ...style }: OtherOpts = {},
) =>
  Div(
    range(1, NUM_CELLS).map((i) => {
      const isComplete = i === 1 || i / NUM_CELLS <= clamp(progress, 0, 1)
      return cell({ isComplete, completeColor })
    }),
    { ...style, height: FONT_SIZE },
  )
