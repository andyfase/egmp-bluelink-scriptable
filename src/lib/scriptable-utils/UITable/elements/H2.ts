import Div, { NonCascadingDiv } from './Div'
import Icon, { IconOrSFKey } from './Icon'
import P from './P'
import { ContainerStyle } from './shapes'
import { TapProps } from './types'

export type H2Opts = { icon?: IconOrSFKey } & ContainerStyle & TapProps

export default (text: string, { icon, ...restOpts }: H2Opts = {}) => {
  const el = NonCascadingDiv(
    [
      Div(
        [P(text, { font: (n) => Font.mediumSystemFont(n), fontSize: 20 }), icon && Icon(icon, { width: '10%' })],
        restOpts,
      ),
    ],
    { marginTop: 15 },
  )
  el.setDescription(`H2 > text: ${text}`)
  return el
}
