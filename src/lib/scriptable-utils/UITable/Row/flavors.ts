import { getColors, getDynamicColor } from '../../colors'
import { Identity } from '../../types/utilTypes'
import presetStyles, { FlavorKey } from '../elements/presetStyles'
import { H1Consts } from './templates/consts'
import { Flavor } from './types'

const flav: Identity<Flavor> = (f) => f

const {
  deep_blue,
  domain_personal,
  domain_work,
  gray0,
  gray2,
  gray8,
  green_l4,
  green,
  primaryTextColor,
  red_d1,
  red_l4,
  yellow_d2,
  yellow_l3,
} = getColors()

const serene = flav({ bgColor: deep_blue, color: gray2 })
const transparent = flav({ noBorder: true })

const h1FlavorOpts = { fontConstructor: H1Consts.fontConstructor }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const flavors = {
  default: flav({
    bgColor: getDynamicColor(gray0, gray8),
    color: primaryTextColor,
  }),
  defaultNoBorder: flav({
    bgColor: getDynamicColor(gray0, gray8),
    noBorder: true,
  }),
  happy: flav({ bgColor: green_l4, color: green }),
  warning: flav({ bgColor: yellow_l3, color: yellow_d2 }),
  danger: flav({ bgColor: red_l4, color: red_d1 }),
  transparent,
  transparentH1: flav({ ...transparent, ...h1FlavorOpts }),
  transparentWithBorder: flav({}),
  serene,
  sereneH1: flav({ ...serene, ...h1FlavorOpts, noBorder: true }),
  domainPersonal: flav({ color: domain_personal }),
  domainWork: flav({ color: domain_work }),
}

export const parseFlavor = (f: FlavorKey | FlavorOption = 'default') => presetStyles().flavors[f]

export type FlavorOption = keyof typeof flavors
