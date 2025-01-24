import { conditionalArr } from '../../../array'
import { SFSymbolKey } from '../../../sfSymbols'
import { H1 } from '../../elements'
import { RowOpts } from '../types'

export type H1Opts = {
  title: string
  subtitle?: string
  titleColor?: Color
  subtitleColor?: Color
  /** Shown in place of action indicator icon */
  badgeNumber?: number
  icon?: SFSymbolKey
} & Pick<RowOpts, 'onTap' | 'isFaded'>

export default ({ title, badgeNumber, subtitle, ...rest }: H1Opts) =>
  H1(title, {
    subtitle: subtitle || badgeNumber ? conditionalArr([subtitle, badgeNumber]).join(', ') : undefined,
    ...rest,
  })
