import { ExcludeFalsy } from '../../common'
import { Falsy } from '../../types/utilTypes'
import { Cell, CellContainer, CellShapeStyle } from './shapes'

export default (children: (Cell | Falsy)[], style: CellShapeStyle = {}) => {
  const el = new CellContainer(children.filter(ExcludeFalsy), style)
  el.setDescription(`SPAN > children: ${children.length}`)
  return el
}
