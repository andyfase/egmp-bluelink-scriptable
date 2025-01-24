import { conditionalArr } from '../../array'
import { getColor } from '../../colors'
import { tidyLog } from '../../string'
import { AnyObj } from '../../types/utilTypes'
import { BaseCellParams, BaseRowOpts } from '../Row/base'
import { CascadingCellStyle, CascadingRowStyle, CascadingStyle, CellStyle, RowStyle, TapProps } from './types'
import {
  fillInCellWidthBlanks,
  getContainerSurroundingRowsOpts,
  normalizeCellWidthPercentages,
  parsePercent,
  parseRowHeight,
  tapPropsToBaseRowOpts,
} from './utils'

type StyleTree = {
  DESCRIPTION: string
  style: AnyObj
  parent: StyleTree | null
}
const getNodeStyleTree = (node: AnyElement): StyleTree => ({
  DESCRIPTION: String(node),

  style: node.style,

  parent: node.parent ? getNodeStyleTree(node.parent) : null,
})

abstract class Element<ValidParentType extends Element<any, Style, any>, Style extends AnyObj, Renders> {
  parent: ValidParentType | null = null
  style: Style
  /** Intended to generate a descriptive string for the element, for use in
   * debugging. The goal is to make this work without much user interaction. */
  description = 'ELEMENT'

  constructor(style: Style) {
    this.style = style
  }

  setParent(parent: ValidParentType) {
    this.parent = parent
  }

  setDescription(description: string) {
    this.description = description
  }

  toString() {
    return this.description
  }

  /** To be called just before rendering */
  inheritStyle() {
    if (!this.parent) return
    // Don't inherit debug flag; keep it focused
    const { _debug, ...inheritableParentStyle } = this.parent.style
    this.style = { ...inheritableParentStyle, ...this.style }
    /** Logs to console all styles all the way up the tree. Useful for spotting
     * issues with cascading styles. */
    if (this.style.debug) tidyLog(getNodeStyleTree(this))
  }

  render(): Renders {
    throw new Error('Render not implemented')
  }
}

type AnyElement = Element<any, any, any>

//
//
//

export type CellShapeStyle = Pick<CascadingRowStyle, 'isFaded'> & CascadingCellStyle & CellStyle

type GetCellOptsWithCalibratedWidth = (style: CellShapeStyle, calibratedWidth: number) => BaseCellParams
type CellConstructorOpts = {
  style: CellShapeStyle
  getCellOptsWithCalibratedWidth: GetCellOptsWithCalibratedWidth
}

/** A cell within a `CellContainer`, laid out horizontally. */
export abstract class Cell extends Element<CellContainer | Container, CellShapeStyle, Cell> {
  getCellOptsWithCalibratedWidth: GetCellOptsWithCalibratedWidth

  constructor({ style, getCellOptsWithCalibratedWidth }: CellConstructorOpts) {
    super(style)
    this.getCellOptsWithCalibratedWidth = getCellOptsWithCalibratedWidth
  }

  render() {
    this.inheritStyle()
    return this
  }
}

const isContainerShape = (el: AnyElement): el is Container => el instanceof Container

//
//
//

export type ContainerStyle = CascadingStyle & RowStyle & CellStyle

export type ContainerChild = Container | CellContainer | Cell

const collapseCollidingBorders = (rows: Container[]) =>
  rows.map((row, i, arr) => {
    if (!row.style.borderTop) return row
    const prevChild = arr[i - 1]
    if (!prevChild?.style.borderBottom) return row
    const isSpaceBetweenBorders = Boolean(prevChild.style.marginBottom || row.style.marginTop)
    if (!isSpaceBetweenBorders) row.style.borderTop = 0
    return row
  })

/** A container can contain other Containers, CellContainers, or Cells */
export class Container extends Element<Container, ContainerStyle, BaseRowOpts[]> {
  protected tapProps: TapProps
  protected children: ContainerChild[]

  constructor(children: ContainerChild[], style: ContainerStyle, tapProps: TapProps) {
    super(style)
    this.tapProps = tapProps
    this.children = children
    for (const element of this.children) element.setParent(this)
  }

  private getBgColor() {
    return this.style.bgColor ?? getColor('bg')
  }

  private wrapRowsWithSpacingAndBorder(contents: BaseRowOpts[]) {
    const { borderBottomRow, borderTopRow, marginBottomRow, marginTopRow, paddingBottomRow, paddingTopRow } =
      getContainerSurroundingRowsOpts(this.style, this.getBgColor(), this.tapProps)
    return conditionalArr([
      marginTopRow,
      borderTopRow,
      paddingTopRow,
      ...contents,
      paddingBottomRow,
      borderBottomRow,
      marginBottomRow,
    ])
  }

  private getPartialBaseRowOpts(): BaseRowOpts {
    return {
      height: parseRowHeight(this.style),
      bgColor: this.getBgColor(),
      ...tapPropsToBaseRowOpts(this.tapProps),
    }
  }

  render(): BaseRowOpts[] {
    this.inheritStyle()

    // Treat it as a row with no cells
    if (this.children.length === 0) {
      return this.wrapRowsWithSpacingAndBorder([this.getPartialBaseRowOpts()])
    }

    // If the Container is NOT functioning as a UITableRow
    if (this.children.every(isContainerShape)) {
      return this.wrapRowsWithSpacingAndBorder(
        collapseCollidingBorders(this.children).flatMap((row) => {
          row.tapProps = { ...this.tapProps, ...row.tapProps }
          return row.render()
        }),
      )
    }

    if (this.children.some(isContainerShape)) {
      throw new Error('If a Container has a Container child, all siblings must also be Containers')
    }

    // ELSE: Children are a mix of Cells and CellContainers, thus we render a
    // single row (with padding/margin)

    const cells = (this.children as (CellContainer | Cell)[]).flatMap((child) => child.render())
    const calibratedCellWidths = normalizeCellWidthPercentages(
      fillInCellWidthBlanks(cells.map((cell) => (cell.style.width ? parsePercent(cell.style.width) : undefined))),
    )
    const mainRow: BaseRowOpts = {
      cells: cells.map((cell, i) => {
        const calibratedWidth = calibratedCellWidths[i]!
        return cell.getCellOptsWithCalibratedWidth(cell.style, calibratedWidth)
      }),
      ...this.getPartialBaseRowOpts(),
    }
    return this.wrapRowsWithSpacingAndBorder([mainRow])
  }
}

export class CellContainer extends Element<Container | CellContainer, CellShapeStyle, Cell[]> {
  protected children: Cell[]

  constructor(children: Cell[], style: CellShapeStyle) {
    super(style)
    this.children = children
    for (const cell of this.children) cell.setParent(this)
  }

  render() {
    this.inheritStyle()
    return this.children.map((child) => child.render())
  }
}
