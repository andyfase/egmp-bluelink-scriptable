import P from './P'
import { Percent } from './types'

/** Used to pad cells in a row */
export default (width: Percent) => {
  const el = P('', { width })
  el.setDescription('HSPACE')
  return el
}
