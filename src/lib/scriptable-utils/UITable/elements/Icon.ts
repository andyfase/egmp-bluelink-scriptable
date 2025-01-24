import { getColor } from '../../colors'
import { IconKey, ICONS } from '../../icons'
import { getSfSymbolImg, SFSymbolKey } from '../../sfSymbols'
import { isSFSymbolKey } from '../../sfSymbols/utils'
import { Cell, CellShapeStyle } from './shapes'
import { maybeFadeForegroundColor } from './utils'

export type IconOrSFKey = SFSymbolKey | IconKey

type IconOpts = CellShapeStyle & { doNotTint?: boolean }

class Icon extends Cell {
  constructor(key: IconOrSFKey, { doNotTint = false, ...style }: IconOpts) {
    super({
      style,
      getCellOptsWithCalibratedWidth: (inheritedStyle, widthWeight) => {
        const {
          align = 'center',
          color = getColor('primaryTextColor'),
          font = (n) => Font.boldSystemFont(n),
          fontSize = 20,
        } = inheritedStyle
        const parsedColor = maybeFadeForegroundColor(color, inheritedStyle)
        return isSFSymbolKey(key)
          ? {
              type: 'image',
              value: getSfSymbolImg(key, doNotTint ? null : parsedColor),
              align,
              widthWeight,
            }
          : {
              type: 'text',
              value: ICONS[key],
              align,
              widthWeight,
              color: parsedColor,
              font: font(fontSize),
            }
      },
    })
  }
}

export default (key: IconOrSFKey, style: IconOpts = {}) => {
  const el = new Icon(key, style)
  el.setDescription(`ICON > key: "${key}"`)
  return el
}
