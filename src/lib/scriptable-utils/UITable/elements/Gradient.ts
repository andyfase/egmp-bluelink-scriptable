import { getColor, getGradientMidpoints } from '../../colors'
import Div from './Div'
import HR from './HR'

type StepOptions = {
  /** Num of rows to show, showing color fade */
  numShownSteps: number
  /** The height of the row containing 1 step in the gradient */
  stepRowHeight: number
  /** To what percent of the way from `from` to `to` should the gradient advance?
   * E.g. for value `1`, show the full fade, ending on `to` (-1). */
  fadeUntilPercentOfTo: number
}

export type GradientMode = 'UP' | 'DOWN'

type GradientOpts = {
  from: Color
  to?: Color
  mode: GradientMode
  stepOptions?: Partial<StepOptions>
}

const DEFAULT_STEP_OPTS: StepOptions = {
  numShownSteps: 2,
  stepRowHeight: 1,
  fadeUntilPercentOfTo: 1,
}

/** Returns a container of small rows that imitate a gradient */
const Gradient = ({
  from,
  mode,
  to = getColor('bg'),
  stepOptions: {
    fadeUntilPercentOfTo = DEFAULT_STEP_OPTS.fadeUntilPercentOfTo,
    numShownSteps = DEFAULT_STEP_OPTS.numShownSteps,
    stepRowHeight = DEFAULT_STEP_OPTS.stepRowHeight,
  } = DEFAULT_STEP_OPTS,
}: GradientOpts) => {
  const totalSteps = Math.floor(numShownSteps / fadeUntilPercentOfTo)
  const gradientColors = getGradientMidpoints({
    from,
    to,
    numPoints: totalSteps,
  })
  const rows = gradientColors
    .slice(0, numShownSteps)
    .map((color) => HR({ height: stepRowHeight, color, marginBottom: 0, marginTop: 0 }))

  const el = Div(mode === 'DOWN' ? rows : rows.reverse())
  el.setDescription(`GRADIENT > ${mode}`)
  return el
}
export default Gradient
