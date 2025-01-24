import { ScreenHeightMeasurements } from '../../configRegister'
import { SFSymbolKey } from '../../sfSymbols'
import { Align, MakeSomeReqd, NoParamFn } from '../../types/utilTypes'

export type RowSize = 'sm' | 'md' | 'lg'

export type Percent = `${number}%`

export type BGColorMode = 'selected' | 'callout'

type SizeOrCustomType = RowSize | number

type PaddingOpts = {
  paddingTop?: SizeOrCustomType
  paddingBottom?: SizeOrCustomType
}

export type SizeMap = Record<RowSize, number | Percent>

export type ContentAreaOpts =
  // Only one will be evaluated
  Partial<{
    iconKey: SFSymbolKey
    text: string | number
    isEmpty: true
    image: Image
  }> &
    Partial<{
      color: Color
      textSize: SizeOrCustomType
      fontConstructor: (textSize: number) => Font
      align: Align
      width: number
    }>

export type RowOpts = {
  rowHeight?: SizeOrCustomType | Percent
  /** NB: There is default padding. */
  padding?: PaddingOpts
  bgColor?: Color | BGColorMode
  isFaded?: boolean
  onTap?: NoParamFn
  onDoubleTap?: NoParamFn
  onTripleTap?: NoParamFn
  dismissOnTap?: boolean
  content?: ContentAreaOpts[]
  /** Optional, used to determine whether the table is in fullscreen or not,
   * which is useful if using percentages as screen height. */
  mode?: ScreenHeightMeasurements.Mode
}

type OnlyNumber<T> = Exclude<T, RowSize | Percent>

export type ParsedPaddingOpts = Required<{
  [key in keyof PaddingOpts]: OnlyNumber<PaddingOpts[key]>
}>

/** Attributes of a row that is valid (unlike RowOpts, which will have fallbacks assigned) */
export type ParsedRowOpts = MakeSomeReqd<RowOpts, 'content', 'padding' | 'bgColor'> & {
  rowHeight: OnlyNumber<Required<RowOpts>['rowHeight']>
  padding: ParsedPaddingOpts
  bgColor: Color
}

export type Flavor = Pick<ContentAreaOpts, 'color' | 'fontConstructor'> & {
  noBorder?: boolean
  bgColor?: Color
}
