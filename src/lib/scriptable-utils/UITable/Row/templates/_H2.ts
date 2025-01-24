import { getDynamicColor } from '../../../colors'
import { SFSymbolKey } from '../../../sfSymbols'
import H2, { H2Opts } from '../../elements/H2'
import { ContentAreaOpts, RowOpts } from '../types'

type Opts = { label: string; iconKey?: SFSymbolKey } & Pick<ContentAreaOpts, 'color'> &
  Pick<RowOpts, 'onTap' | 'onDoubleTap' | 'onTripleTap' | 'dismissOnTap' | 'isFaded' | 'padding'> &
  H2Opts

export default ({ label, color = getDynamicColor('black', 'white'), iconKey, ...restOpts }: Opts) => {
  return H2(label, { color, icon: iconKey, ...restOpts })
}
