import { getColor } from '../../colors'
import { truncate } from '../../string'
import { Cell, CellShapeStyle } from './shapes'
import { maybeFadeForegroundColor } from './utils'

export class P extends Cell {
  constructor(text: string, style: CellShapeStyle) {
    super({
      style,
      getCellOptsWithCalibratedWidth: (
        {
          align = 'left',
          color = getColor('primaryTextColor'),
          font = (n) => Font.regularRoundedSystemFont(n),
          fontSize = 20,
        },
        widthWeight,
      ) => {
        const parsedColor = maybeFadeForegroundColor(color, this.style)
        return {
          type: 'text',
          value: text,
          align,
          widthWeight,
          color: parsedColor,
          font: font(fontSize),
        }
      },
    })
  }
}

export default (text: string, style: CellShapeStyle = {}) => {
  const el = new P(text, style)
  el.setDescription(`P > text: "${truncate(text, 20)}"`)
  return el
}
