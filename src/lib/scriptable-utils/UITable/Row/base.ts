import { ErrorWithPayload, isObject, isString } from '../../common'
import { getConfig } from '../../configRegister'
import { shortSwitch } from '../../flow'
import PersistedLog from '../../io/PersistedLog'
import { Align } from '../../types/utilTypes'

const warnError = async (error: unknown, context: string) => {
  console.warn(error)
  const prompt = new Alert()
  prompt.title = `Error in ${context} (see log)`
  prompt.message = String(error)
  prompt.addAction('OK')
  const stacktrace = isObject(error) && 'stack' in error ? error.stack : undefined
  PersistedLog.log({
    type: 'Error',
    context,
    error: JSON.stringify(error),
    stacktrace,
  })
  await prompt.present()
}

//

type CellType = 'button' | 'text' | 'image'

type CellParamsBase = {
  widthWeight?: number
  align?: Align
  onTap?: () => any
  dismissOnTap?: boolean
}
type TextCellParams = {
  color?: Color
  font?: Font
}
export type BaseCellParams = {
  value?: string | Image
  type?: CellType
} & CellParamsBase &
  TextCellParams

type Cell = {
  /** Image cell or no params */
  (params?: CellParamsBase & { type: 'image'; value: Image }): UITableCell
  /** Button or text cell */
  (
    params: CellParamsBase &
      TextCellParams & {
        type?: 'button' | 'text' // Default text
        value: string
      },
  ): UITableCell
}

export const BaseCell: Cell = ({
  type = 'button',
  widthWeight = 1,
  align = 'center',
  onTap = () => {},
  dismissOnTap = false,
  value = '',
  color,
  font,
}: BaseCellParams = {}) => {
  const cell = (() => {
    if (type === 'image' && !isString(value)) return UITableCell.image(value)
    if (!isString(value)) throw new Error('Trying to pass image into text cell.')
    if (type === 'button') return UITableCell.button(value)
    return UITableCell.text(value)
  })()
  cell.widthWeight = widthWeight
  shortSwitch(align, {
    center: () => cell.centerAligned(),
    left: () => cell.leftAligned(),
    right: () => cell.rightAligned(),
  })()
  cell.dismissOnTap = dismissOnTap
  cell.onTap = async () => {
    try {
      await onTap()
    } catch (e) {
      await warnError(e, `table cell with label "${String(value)}"`)
    }
  }
  if (color) cell.titleColor = color
  if (font) cell.titleFont = font
  return cell
}

//
//
//

export type BaseRowOpts = Partial<{
  onTap: () => any
  onDoubleTap: () => any
  onTripleTap: () => any
  /** For advanced usage, use `overrideClickMap` to add an unlimited number of
   * click listeners (i.e. to have on4Taps, on5Taps... etc) */
  overrideClickMap?: ClickMap
  dismissTableOnTap?: boolean
  cells: (UITableCell | BaseCellParams)[]
  isHeader: boolean
  height: number
  bgColor: Color
}>

type ClickMap = Partial<Record<number, () => any>>

const executeTapListener = (() => {
  let tapCount = 0
  const clickTimer = new Timer()
  return (clickMap: ClickMap) => {
    clickTimer.timeInterval = getConfig('ON_TAP_CLICK_INTERVAL')
    const maxClicks = Math.max(...Object.keys(clickMap).map((numStr) => Number.parseInt(numStr, 10)))
    // Every time a tap comes in, restart the timer & increment the counter
    tapCount++
    clickTimer.invalidate()
    const executeFn = async () => {
      try {
        const action = clickMap[tapCount]
        if (!action) {
          throw new ErrorWithPayload('Action at index not found', {
            tapCount,
            maxClicks,
            clickKeysPassed: Object.keys(clickMap),
          })
        }
        tapCount = 0
        await action()
      } catch (e) {
        warnError(e, 'table row')
      }
    }
    // The timer callback will only ever fire if a click timer reaches its full
    // duration
    if (maxClicks <= tapCount) executeFn()
    else clickTimer.schedule(executeFn)
  }
})()

/** Base cell params must have a type, or must be an empty object. */
const isCell = (x: UITableCell | BaseCellParams): x is UITableCell =>
  Boolean(Object.keys(x).length > 0 && !('type' in x))

export const BaseRow = ({
  cells = [],
  height,
  isHeader = false,
  onTap = () => {},
  onDoubleTap,
  onTripleTap,
  overrideClickMap,
  dismissTableOnTap = false,
  bgColor,
}: BaseRowOpts = {}) => {
  const returnRow = new UITableRow()
  returnRow.isHeader = isHeader
  returnRow.dismissOnSelect = dismissTableOnTap

  returnRow.onSelect = () =>
    executeTapListener(
      overrideClickMap ?? {
        1: onTap,
        ...(onDoubleTap && { 2: onDoubleTap }),
        ...(onTripleTap && { 3: onTripleTap }),
      },
    )
  if (height) returnRow.height = height
  if (bgColor) returnRow.backgroundColor = bgColor
  if (cells.length > 0) for (const c of cells) returnRow.addCell(isCell(c) ? c : BaseCell(c as unknown as undefined))
  return returnRow
}
