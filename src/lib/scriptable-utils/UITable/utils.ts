import alert from '../input/alert'
import { Container } from './elements/shapes'
import { BaseRow } from './Row/base'

export const reloadTableRows = (table: UITable, rows: (UITableRow | Container)[]) => {
  table.removeAllRows()
  for (const row of rows) {
    if (row instanceof Container) {
      const rowOpts = row.render()
      for (const opts of rowOpts) table.addRow(BaseRow(opts))
    } else {
      table.addRow(row)
    }
  }
  table.reload()
}

export const catchTableError = async (error: any, tableName: string) => {
  console.warn(error)
  await alert({
    title: `Error encountered in ${tableName} render`,
    message: String(error),
    buttons: { OK: {} },
  })
}
