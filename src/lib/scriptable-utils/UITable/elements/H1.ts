import { conditionalArr } from '../../array'
import Div from './Div'
import Icon, { IconOrSFKey } from './Icon'
import P from './P'
import { ContainerStyle } from './shapes'
import { CascadingStyle, TapProps } from './types'
import { getTapProps, numToPct } from './utils'

type H1Opts = Partial<{
  subtitle: string
  titleColor: Color
  subtitleColor: Color
  icon?: IconOrSFKey
}> &
  Pick<CascadingStyle, 'isFaded' | 'marginBottom' | 'marginTop'> &
  TapProps

const ICON_WIDTH = 10
const NO_SPACING: ContainerStyle = {
  marginBottom: 0,
  marginTop: 0,
  paddingBottom: 0,
  paddingTop: 0,
}

const getTopRow = (title: string, { titleColor, icon, ...restProps }: H1Opts) => {
  const tapProps = getTapProps(restProps)
  const hasOnTap = Boolean(tapProps.onTap || tapProps.onDoubleTap || tapProps.onTripleTap)
  const displayedIcon: IconOrSFKey | null = icon ?? (hasOnTap ? 'ellipsis_circle' : null)
  const textWidth = numToPct(100 - (displayedIcon ? ICON_WIDTH : 0))
  return Div(
    conditionalArr([
      P(title, {
        font: (n) => Font.boldSystemFont(n),
        fontSize: 25,
        width: textWidth,
        color: titleColor,
      }),

      displayedIcon &&
        Icon(displayedIcon, {
          width: numToPct(ICON_WIDTH),
          isFaded: true,
          color: titleColor,
        }),
    ]),
    { ...NO_SPACING, ...tapProps },
  )
}

const getSubtitleRow = (subtitle: string, { subtitleColor, ...restProps }: H1Opts) =>
  Div([P(subtitle)], {
    font: () => Font.footnote(),
    color: subtitleColor,
    height: 14,
    ...NO_SPACING,
    ...getTapProps(restProps),
  })

export default (text: string, opts: H1Opts = {}) => {
  const { subtitle, isFaded, marginBottom, marginTop } = opts
  const el = Div([getTopRow(text, opts), subtitle && getSubtitleRow(subtitle, opts)], {
    marginTop,
    marginBottom,
    isFaded,
    paddingTop: 10,
    paddingBottom: 15,
    ...getTapProps(opts),
  })
  el.setDescription(`H1 > title: ${text}`)
  return el
}
