import { conditionalArr } from '../../../array'
import { getColor } from '../../../colors'
import { fade } from '../../../common'
import Row from '../Row'
import { RowOpts } from '../types'

type Opts = { dim?: number; color?: Color; height?: number } & Pick<RowOpts, 'padding'>

export const DEFAULT_HR_HEIGHT = 1

const noPadding: Pick<RowOpts, 'padding'> = {
  padding: { paddingTop: 0, paddingBottom: 0 },
}

/** NB: padding is different in this context in that it will have a different
 * bgColor than the HR row. */
export default ({
  dim = 0,
  padding: { paddingBottom = 0, paddingTop = 0 } = {
    paddingBottom: 0,
    paddingTop: 0,
  },
  color = getColor('hr'),
  height = DEFAULT_HR_HEIGHT,
}: Opts = {}) =>
  conditionalArr([
    paddingTop && Row({ rowHeight: paddingTop, ...noPadding }),
    Row({ rowHeight: height, bgColor: fade(color, dim), ...noPadding }),
    paddingBottom && Row({ rowHeight: paddingBottom, ...noPadding }),
  ]).flat()
