import { getColor } from '../../colors'
import { NonCascadingDiv } from './Div'
import Gradient from './Gradient'
import { IconOrSFKey } from './Icon'
import presetStyles, { FlavorKey } from './presetStyles'
import { ContainerStyle } from './shapes'
import ThreeCol from './ThreeCol'
import { TapProps } from './types'

type OwnButtonOpts = {
  icon: IconOrSFKey
  text: string
  isDisabled?: boolean
  isLarge?: boolean
  containerStyle?: ContainerStyle
  flavor?: FlavorKey
}

type ShouldFadeGradientToColorRecord = {
  flavor: FlavorKey
  screenMode: 'DARK' | 'LIGHT' | 'ALL'
}

const REQUIRES_FADE_TO_TEXT_COLOR: ShouldFadeGradientToColorRecord[] = [
  { flavor: 'secondary', screenMode: 'LIGHT' },
  { flavor: 'transparent', screenMode: 'ALL' },
]

/** This is important in cases where the button bgColor is so close to the
 * bgColor that the fade is effectively invisible. In this case, the gradient
 * will instead fade toward the text color to create a visible divider. */
const shouldFadeGradientToTextColor = (flavor: FlavorKey) => {
  const mode = Device.isUsingDarkAppearance() ? 'DARK' : 'LIGHT'
  return REQUIRES_FADE_TO_TEXT_COLOR.some(
    (record) => record.flavor === flavor && (record.screenMode === 'ALL' || record.screenMode === mode),
  )
}

type UserStyle = ContainerStyle & TapProps

export type ButtonOpts = OwnButtonOpts & UserStyle

const DISABLED_STYLE: UserStyle = {
  isFaded: true,
  onTap: undefined,
  onDoubleTap: undefined,
  onTripleTap: undefined,
  dismissOnTap: false,
}

type ComposeButtonStyleParams = Pick<OwnButtonOpts, 'isDisabled' | 'isLarge' | 'flavor'> & { userStyle: UserStyle }
const composeButtonStyle = ({ userStyle, isDisabled, isLarge, flavor }: ComposeButtonStyleParams) => ({
  ...presetStyles().button[isLarge ? 'large' : 'default'],
  ...(flavor && presetStyles().flavors[flavor]),
  ...userStyle,
  ...(isDisabled && DISABLED_STYLE),
})

export default ({
  icon,
  text,
  isDisabled,
  isLarge,
  containerStyle,
  flavor = 'secondary',
  ...userStyle
}: ButtonOpts) => {
  const composedButtonStyle = composeButtonStyle({
    userStyle,
    isDisabled,
    isLarge,
    flavor,
  })

  const bgColor = userStyle.bgColor ?? composedButtonStyle.bgColor
  if (!bgColor) {
    throw new Error(`No bgColor in Button "${text}". This is a symptom of passed props overwriting its value`)
  }
  const color = userStyle.color ?? composedButtonStyle.color
  if (!color) {
    throw new Error(`No color in Button "${text}". This is a symptom of passed props overwriting its value`)
  }

  const el = NonCascadingDiv(
    [
      ThreeCol({
        ...composedButtonStyle,
        text,
        metadataIcon: icon,
        borderBottom: 0,
        /** In the case of transparent buttons, this is needed to delineate the
         * top of the button. */
        borderTop: bgColor.hex === getColor('bg').hex ? [1, getColor('hr')] : 0,
      }),
      Gradient({
        from: bgColor,
        mode: 'DOWN',
        ...(shouldFadeGradientToTextColor(flavor) && { to: color }),
      }),
    ],
    containerStyle,
  )
  el.setDescription(`BUTTON > text: "${text}"`)
  return el
}
