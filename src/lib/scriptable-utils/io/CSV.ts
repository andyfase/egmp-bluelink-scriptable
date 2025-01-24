import { isEqual } from '../object'
import { AnyObj } from '../types/utilTypes'
import persisted from './persisted'

// ts-unused-exports:disable-next-line
export default (filename: string, data: AnyObj[]) => {
  const io = persisted<string>({
    filename,
    defaultData: '',
    fileExtension: 'csv',
  })
  return {
    ...io,
    write: () => {
      const firstRow = data[0]
      const colNames = firstRow ? Object.keys(firstRow) : []
      const areAllColsSame = data.slice(1).every((row) => isEqual(Object.keys(row), colNames))
      if (!areAllColsSame) throw new Error('Column names are not uniform')
      const colRow = colNames.join(',')
      const dataRows = data.map((row) => colNames.map((colName) => String(row[colName]).replaceAll('"', "'")).join(','))
      return io.write({ data: [colRow, ...dataRows].join('\n') })
    },
  }
}
