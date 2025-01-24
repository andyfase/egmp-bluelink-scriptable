import { isString } from '../../common'
import { isIconKey } from '../../icons'
import { isSFSymbolKey } from '../../sfSymbols/utils'
import Div from './Div'
import Icon, { IconOrSFKey } from './Icon'
import P from './P'
import { Cell, ContainerStyle } from './shapes'
import { TapProps } from './types'
import { numToPct } from './utils'

type ThreeColOwnOpts = {
  icon?: IconOrSFKey
  text: string
  metadata?: string | number
  metadataIcon?: IconOrSFKey
}

type ThreeColOpts = ThreeColOwnOpts & ContainerStyle & TapProps

type MetadataCellData = { metadataCell: Cell | null; width: number }

const ICON_WIDTH = 10
const METADATA_TEXT_WIDTH = 20

const getMetadataCell = (
  metadata: ThreeColOwnOpts['metadata'],
  metadataIcon: ThreeColOwnOpts['metadataIcon'],
  cascadedStyle: ContainerStyle & TapProps,
): MetadataCellData => {
  if (isString(metadataIcon) && (isIconKey(metadataIcon) || isSFSymbolKey(metadataIcon))) {
    return {
      metadataCell: Icon(metadataIcon, {
        ...cascadedStyle,
        width: numToPct(ICON_WIDTH),
        align: 'center',
      }),
      width: ICON_WIDTH,
    }
  }
  if (metadata) {
    return {
      metadataCell: P(String(metadata), {
        width: numToPct(METADATA_TEXT_WIDTH),
        align: 'right',
        font: (n) => Font.thinSystemFont(n),
        fontSize: 15,
      }),
      width: METADATA_TEXT_WIDTH,
    }
  }

  return { metadataCell: null, width: 0 }
}

export default ({ icon, text, metadata, metadataIcon, ...cascadingProps }: ThreeColOpts) => {
  const { metadataCell, width: metadataCellWidth } = getMetadataCell(metadata, metadataIcon, cascadingProps)
  const el = Div(
    [
      icon &&
        Icon(icon, {
          align: 'center',
          width: numToPct(ICON_WIDTH),
        }),

      P(text, {
        width: numToPct(100 - (icon ? ICON_WIDTH : 0) - metadataCellWidth),
      }),

      metadataCell,
    ],
    { paddingTop: 10, paddingBottom: 10, ...cascadingProps },
  )
  el.setDescription(`THREECOL > text: "${text}"`)
  return el
}
