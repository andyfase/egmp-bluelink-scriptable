import Row from '../Row'
import { RowOpts } from '../types'

const DEFAULT_HEIGHT = 15

export default ({ rowHeight = DEFAULT_HEIGHT, ...restOpts }: Omit<RowOpts, 'content' | 'padding'> = {}) =>
  Row({ rowHeight, padding: { paddingTop: 0, paddingBottom: 0 }, ...restOpts })
