import { ScreenHeightMeasurements } from '../../configRegister'
import { Align } from '../../types/utilTypes'
import { BaseRowOpts } from '../Row'

export type Percent = `${number}%`

/** If no color provided, defaults to inherited value, or default text color. */
export type Border = number | [borderHeight: number, color: Color]

export type CascadingRowStyle = Partial<{
  bgColor: Color
  /** Optional, used to determine whether the table is in fullscreen or not,
   * which is useful if using percentages as screen height. */
  mode: ScreenHeightMeasurements.Mode
  isFaded: boolean
  borderTop: Border
  borderBottom: Border
  paddingTop: number
  paddingBottom: number
  marginTop: number
  marginBottom: number
}>

export type CascadingCellStyle = Partial<{
  color: Color
  fontSize: number
  font: (textSize: number) => Font
  align: Align
  /** Flag used to print style tree to console. */
  debug: boolean
}>

export type CascadingStyle = CascadingRowStyle & CascadingCellStyle

/** Row style applies only to rows and does not cascade */
export type RowStyle = Partial<{ height: number | Percent }>

/** Cell style applies only to cells and does not cascade */
export type CellStyle = Partial<{
  /** Default is an equal split with other cells. If the sum of combined cell
   * width percentages exceeds 100%, cells to the left will be given priority. */
  width: Percent
}>

export type TapProps = Partial<
  Pick<BaseRowOpts, 'overrideClickMap' | 'onTap' | 'onDoubleTap' | 'onTripleTap'> & { dismissOnTap: boolean }
>
