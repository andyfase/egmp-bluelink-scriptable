import { conditionalArr } from '../../../array'
import { Align, Identity } from '../../../types/utilTypes'
import { DEFAULT_GRID_WIDTH, DEFAULT_LEFT_GUTTER_WIDTH, DEFAULT_RIGHT_GUTTER_WIDTH } from '../consts'
import { ContentAreaOpts, RowOpts } from '../types'
import { getRowConstructor } from './utils'

type OwnContentAreaOpts = Omit<ContentAreaOpts, 'align' | 'width'>
type OwnOpts = {
  gutterLeft?: OwnContentAreaOpts
  main: OwnContentAreaOpts
  gutterRight?: OwnContentAreaOpts
}
type CellID = keyof OwnOpts
type WidthMap = Record<CellID, number>

const ALIGN: Record<CellID, Align> = {
  gutterLeft: 'center',
  main: 'left',
  gutterRight: 'right',
}

const getWidths = ({ gutterLeft, gutterRight }: OwnOpts): WidthMap => {
  const gutterLeftWidth = (gutterLeft && DEFAULT_LEFT_GUTTER_WIDTH) ?? 0
  const gutterRightWidth = (gutterRight && DEFAULT_RIGHT_GUTTER_WIDTH) ?? 0
  return {
    gutterLeft: gutterLeftWidth,
    main: DEFAULT_GRID_WIDTH - gutterLeftWidth - gutterRightWidth,
    gutterRight: gutterRightWidth,
  }
}

const makeContentAreaOpts = (opts: OwnContentAreaOpts, cellID: CellID, widthMap: WidthMap): ContentAreaOpts => ({
  ...opts,
  width: widthMap[cellID],
  align: ALIGN[cellID],
})

const getThreeColReducer = (ownOpts: OwnOpts): Identity<RowOpts> => {
  const { gutterLeft, main, gutterRight } = ownOpts
  return (rowOpts) => {
    const widths = getWidths(ownOpts)
    return {
      ...rowOpts,
      content: conditionalArr([
        gutterLeft && makeContentAreaOpts(gutterLeft, 'gutterLeft', widths),
        makeContentAreaOpts(main, 'main', widths),
        gutterRight && makeContentAreaOpts(gutterRight, 'gutterRight', widths),
      ]),
    }
  }
}

export default getRowConstructor(getThreeColReducer)
