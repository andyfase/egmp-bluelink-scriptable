import { conditionalArr } from '../../array'
import { compose, filter, map, toArray } from '../../arrayTransducers'
import { getColor } from '../../colors'
import { ErrorWithPayload, ExcludeFalsy, isNumber, isString } from '../../common'
import { getSfSymbolImg } from '../../sfSymbols'
import { MapKeys } from '../../types/utilTypes'
import { BaseCell, BaseRow } from './base'
import { bgColorModeToColor, textSizeToNumMap } from './consts'
import { BGColorMode, ContentAreaOpts, ParsedRowOpts, RowOpts } from './types'
import { parseHeightVals, parseSizeValue } from './utils'

const parseBgColorValue = (bgColor: Color | BGColorMode) => (isString(bgColor) ? bgColorModeToColor[bgColor] : bgColor)

const parseRowOpts = ({
  bgColor = getColor('bg'),
  rowHeight,
  padding,
  mode,
  content = [],
  ...rest
}: RowOpts): ParsedRowOpts => ({
  ...rest,
  content,
  bgColor: parseBgColorValue(bgColor),
  ...parseHeightVals({ padding, rowHeight, mode }),
})

//
//
//

const parseColor = (color: Color, { isFaded }: ParsedRowOpts) => (isFaded ? new Color(color.hex, 0.6) : color)

const getCell = (
  {
    iconKey,
    text,
    isEmpty,
    image,
    color = getColor('primaryTextColor'),
    fontConstructor = (n) => Font.regularRoundedSystemFont(n),
    textSize = 'sm',
    align = 'left',
    width,
  }: ContentAreaOpts,
  parsedRowOpts: ParsedRowOpts,
) => {
  const commonArgs = { widthWeight: width, align }
  const parsedColor = parseColor(color, parsedRowOpts)
  if (iconKey) {
    return BaseCell({
      type: 'image',
      value: getSfSymbolImg(iconKey, parsedColor),
      ...commonArgs,
    })
  } else if (image) {
    return BaseCell({ type: 'image', value: image, ...commonArgs })
  } else if (text !== undefined || isEmpty) {
    return BaseCell({
      type: 'text',
      value: isNumber(text) || isString(text) ? String(text) : '',
      color: parsedColor,
      font: fontConstructor(parseSizeValue(textSize, textSizeToNumMap)),
      ...commonArgs,
    })
  }
  throw new ErrorWithPayload('Cell configuration is invalid', {
    iconKey,
    text,
    isEmpty,
    hasImage: Boolean(image),
  })
}

type CommonRowParams = MapKeys<
  Pick<ParsedRowOpts, 'onTap' | 'onDoubleTap' | 'onTripleTap' | 'dismissOnTap' | 'bgColor'>,
  { dismissTableOnTap: 'dismissOnTap' }
>

const getPadding = (height: number, parsedOpts: ParsedRowOpts, commonArgs: CommonRowParams) =>
  BaseRow({
    cells: [getCell({ isEmpty: true }, parsedOpts)!],
    ...commonArgs,
    height,
  })

export default (opts: RowOpts = {}) => {
  const parsedOpts = parseRowOpts(opts)
  const cells = toArray(
    parsedOpts.content,
    compose(
      map((content) => getCell(content, parsedOpts)),
      filter(ExcludeFalsy),
    ),
  )
  const { bgColor, padding, rowHeight, dismissOnTap, onTap, onDoubleTap, onTripleTap } = parsedOpts
  const commonArgs: CommonRowParams = {
    onTap,
    onDoubleTap,
    onTripleTap,
    dismissTableOnTap: dismissOnTap,
    bgColor,
  }
  return conditionalArr([
    padding.paddingTop && getPadding(padding.paddingTop, parsedOpts, commonArgs),
    BaseRow({
      cells: cells.length > 0 ? cells : [BaseCell()],
      height: rowHeight,
      ...commonArgs,
    }),
    padding.paddingBottom && getPadding(padding.paddingBottom, parsedOpts, commonArgs),
  ]).flat()
}
