import { RowOpts } from '../types'
import { composeRowConstructor } from './utils'
import { getFootnoteReducer } from './_Footnote'
import _HR from './_HR'

type Opts = { label: string } & Pick<RowOpts, 'onTap' | 'onDoubleTap' | 'dismissOnTap' | 'isFaded'>

export default ({ label, ...restOpts }: Opts) => {
  const LabelRow = composeRowConstructor(
    (rowOpts) => ({
      ...rowOpts,
      ...restOpts,
      padding: { paddingTop: 30, paddingBottom: 0 },
      content: [{ text: label, align: 'left' }],
    }),
    getFootnoteReducer(),
  )
  return [LabelRow(), _HR({ padding: { paddingTop: 10 } })].flat()
}
