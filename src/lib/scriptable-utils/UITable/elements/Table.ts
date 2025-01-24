import { insertBetween } from '../../array'
import { getColor } from '../../colors'
import { objectEntries } from '../../object'
import { NoParamFn, Omit_ } from '../../types/utilTypes'
import Div, { DivStyle, NonCascadingDiv } from './Div'
import Gradient from './Gradient'
import HR from './HR'
import P from './P'
import Span from './Span'
import { Percent } from './types'

type TableColumnData = {
  /** Defaults to true for first column, else false */
  isRowValueBold?: boolean
  /** Defaults to even spacing for all columns */
  width?: Percent
}

type ColumnRecord<ColumnLabel extends string> = Record<ColumnLabel, TableColumnData>

type CellValueRecord<ColumnLabel extends string> = Record<ColumnLabel, string>

type RowData<ColumnLabel extends string> = {
  cellValues: CellValueRecord<ColumnLabel>
  onTap?: NoParamFn
}

type Opts<ColumnLabel extends string> = {
  containerStyle?: DivStyle
  columns: ColumnRecord<ColumnLabel>
  rows: RowData<ColumnLabel>[]
  hideColumnNames?: boolean
}

//

const Header = <ColumnLabel extends string>({
  columns,
  hideColumnNames,
}: Pick<Opts<ColumnLabel>, 'columns' | 'hideColumnNames'>) =>
  NonCascadingDiv([
    Gradient({
      from: getColor('hr'),
      mode: 'UP',
      stepOptions: { numShownSteps: 3 },
    }),
    !hideColumnNames &&
      Div(
        objectEntries(columns).map(([columnLabel, { width }]) => P(columnLabel, { width })),
        {
          bgColor: getColor('hr'),
          font: (n) => Font.semiboldSystemFont(n),
          fontSize: 16,
        },
      ),
  ])

const Cell = (value: string, { isRowValueBold, width }: TableColumnData) =>
  P(value, {
    width,
    ...(isRowValueBold && { font: (n) => Font.semiboldSystemFont(n) }),
  })

const Row = <ColumnLabel extends string>(
  { cellValues, onTap }: RowData<ColumnLabel>,
  columns: ColumnRecord<ColumnLabel>,
) =>
  NonCascadingDiv(
    [
      Span(
        objectEntries(cellValues).map(([columnLabel, value]) => Cell(value, columns[columnLabel])),
        { fontSize: 14 },
      ),
    ],
    { onTap, paddingTop: 5, paddingBottom: 5 },
  )

const Rows = <ColumnLabel extends string>({ columns, rows }: Omit_<Opts<ColumnLabel>, 'containerStyle'>) =>
  NonCascadingDiv(
    insertBetween(
      rows.map((row) => Row(row, columns)),
      HR({ marginTop: 0, marginBottom: 0 }),
    ),
  )

const Footer = () =>
  Gradient({
    from: getColor('hr'),
    mode: 'DOWN',
    stepOptions: { numShownSteps: 5 },
  })

//

export default <ColumnLabel extends string>({ columns, rows, containerStyle, hideColumnNames }: Opts<ColumnLabel>) =>
  NonCascadingDiv([Header({ columns, hideColumnNames }), Rows({ columns, rows }), Footer()], {
    marginTop: 10,
    marginBottom: 10,
    ...containerStyle,
  })
