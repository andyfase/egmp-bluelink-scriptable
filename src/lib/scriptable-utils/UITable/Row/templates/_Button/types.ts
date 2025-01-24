import { SFSymbolKey } from '../../../../sfSymbols'
import { MakeSomeOptional, Omit_ } from '../../../../types/utilTypes'
import { FlavorKey } from '../../../elements/presetStyles'
import { FlavorOption } from '../../flavors'
import { ContentAreaOpts, RowOpts, RowSize } from '../../types'

type FromRowOpts = Omit_<RowOpts, 'rowHeight' | 'padding' | 'bgColor' | 'content'>

export type _INTERNAL_ButtonOpts = FromRowOpts & {
  /** All buttons have a top border; if `isLast`, also add a bottom border. */
  isLast: boolean
  isDisabled?: boolean
  flavor: FlavorOption | FlavorKey
  icon?: SFSymbolKey
  metadata?: string | number
  text: string
  isSmall?: boolean
  isLarge?: boolean
}

export type ButtonOpts = Omit_<MakeSomeOptional<_INTERNAL_ButtonOpts, 'flavor'>, 'isLast'>

export type SizeConfig = Pick<ContentAreaOpts, 'textSize'> & {
  rowHeight: RowSize
  padding: RowSize
}

/** Used externally. Opts for a stack of multiple buttons. Always use this for
 * multiple buttons to avoid thinking about border collision. */
export type ButtonStackOpt = ButtonOpts & {
  flavor?: FlavorOption | FlavorKey
  color?: Color
}
