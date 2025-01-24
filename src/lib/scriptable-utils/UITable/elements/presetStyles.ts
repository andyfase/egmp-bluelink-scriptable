import { ColorKey, getColor, getDynamicColor } from '../../colors'
import { isString } from '../../common'
import { MapVals } from '../../types/utilTypes'
import { H1Consts } from '../Row/templates/consts'
import { CascadingStyle, RowStyle } from './types'

const style = ({
  color,
  bgColor,
  ...rest
}: MapVals<CascadingStyle & RowStyle, { color?: Color | ColorKey; bgColor?: Color | ColorKey }>): CascadingStyle &
  RowStyle => ({
  ...rest,
  color: isString(color) ? getColor(color) : color,
  bgColor: isString(bgColor) ? getColor(bgColor) : bgColor,
})

const NO_BORDERS: CascadingStyle = { borderTop: 0, borderBottom: 0 }

const FLAVOR_SERENE = () => style({ bgColor: 'deep_blue', color: 'gray2' })

const FLAVOR_TRANSPARENT = () => style({ bgColor: 'bg', color: 'primaryTextColor' })

const FLAVOR_DEFAULT = () =>
  style({
    bgColor: getDynamicColor('gray0', 'gray8'),
    color: 'primaryTextColor',
  })

const FLAVOR_H1: CascadingStyle = { font: H1Consts.fontConstructor }

const BUTTON_DEFAULT = () =>
  style({
    paddingTop: 10,
    paddingBottom: 10,
    height: 40,
    fontSize: 22,
  })

//

const presetStyles = () => ({
  flavors: {
    default: FLAVOR_DEFAULT(),

    defaultNoBorder: style({ ...FLAVOR_DEFAULT(), ...NO_BORDERS }),

    happy: style({ bgColor: 'caribbean_green', color: 'white' }),

    warning: style({ bgColor: 'jasmine', color: 'field_drab' }),

    danger: style({ bgColor: 'red_500', color: 'white' }),

    transparent: style({ ...FLAVOR_TRANSPARENT(), ...NO_BORDERS }),

    transparentH1: style({
      ...FLAVOR_TRANSPARENT(),
      ...NO_BORDERS,
      ...FLAVOR_H1,
    }),

    transparentWithBorder: style({ ...FLAVOR_TRANSPARENT() }),

    serene: FLAVOR_SERENE(),

    sereneH1: style({ ...FLAVOR_SERENE(), ...FLAVOR_H1, ...NO_BORDERS }),

    domainPersonal: style({ bgColor: 'domain_personal', color: 'white' }),

    domainWork: style({ bgColor: 'domain_work', color: 'white' }),

    primary: style({
      bgColor: getDynamicColor('majorelle_blue', 'neon_blue'),
      color: getDynamicColor('magnolia', 'white'),
    }),

    secondary: style({
      bgColor: getDynamicColor('slate_100', 'black_coral'),
      color: getDynamicColor('slate_700', 'platinum'),
    }),
  },

  button: {
    default: BUTTON_DEFAULT(),

    large: style({
      ...BUTTON_DEFAULT(),
      height: 50,
      fontSize: 26,
      paddingTop: 20,
      paddingBottom: 20,
    }),
  },
})
export default presetStyles

export type FlavorKey = keyof ReturnType<typeof presetStyles>['flavors']
