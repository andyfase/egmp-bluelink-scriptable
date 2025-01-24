// Used as a simpler layer on top of 2/3Col rows, assumes you always use an icon
// in the leftmost, with metadata optional.

import { SFSymbolKey } from '../../../sfSymbols'
import { Omit_ } from '../../../types/utilTypes'
import { ContentAreaOpts, RowOpts } from '../types'
import _ThreeCol from './_ThreeCol'
import _TwoCol from './_TwoCol'

type FromRowOpts = Omit_<RowOpts, 'content'>
type FromContentOpts = Omit_<ContentAreaOpts, 'isEmpty' | 'width' | 'iconKey' | 'text' | 'align'>
type IconRowOpts = FromRowOpts &
  FromContentOpts & {
    icon: SFSymbolKey
    text: string
    metadata?: string | number
  }

export default ({ icon, color, text, metadata, textSize, fontConstructor, ...rowOpts }: IconRowOpts) =>
  metadata
    ? _ThreeCol({
        gutterLeft: { iconKey: icon, color },
        main: { text, color, fontConstructor, textSize },
        gutterRight: { text: metadata, color },
        ...rowOpts,
      })
    : _TwoCol({
        gutterLeft: { iconKey: icon, color },
        main: { text, color, fontConstructor, textSize },
        ...rowOpts,
      })
