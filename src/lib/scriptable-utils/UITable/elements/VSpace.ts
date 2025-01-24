import { Omit_ } from '../../types/utilTypes'
import Div, { DivStyle } from './Div'
import P from './P'
import { Percent } from './types'

/** Add vertical space to a table */
export default (height: number | Percent, style?: Omit_<DivStyle, 'height'>) => {
  const el = Div([P('')], { height, ...style })
  el.setDescription('VSPACE')
  return el
}
