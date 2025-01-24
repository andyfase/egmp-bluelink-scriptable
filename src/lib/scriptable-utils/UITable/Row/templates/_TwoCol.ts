import { Identity } from '../../../types/utilTypes'
import { DEFAULT_GRID_WIDTH, DEFAULT_LEFT_GUTTER_WIDTH } from '../consts'
import { ContentAreaOpts, RowOpts } from '../types'
import { getRowConstructor } from './utils'

type OwnContentAreaOpts = Omit<ContentAreaOpts, 'align' | 'width'>
type OwnOpts = { gutterLeft: OwnContentAreaOpts; main: OwnContentAreaOpts }

const getTwoColReducer =
  ({ gutterLeft, main }: OwnOpts): Identity<RowOpts> =>
  (rowOpts) => ({
    ...rowOpts,
    content: [
      { ...gutterLeft, width: DEFAULT_LEFT_GUTTER_WIDTH, align: 'center' },
      {
        ...main,
        width: DEFAULT_GRID_WIDTH - DEFAULT_LEFT_GUTTER_WIDTH,
        align: 'left',
      },
    ],
  })

export default getRowConstructor(getTwoColReducer)
