import { RowSize } from '../types'

export const H1Consts = {
  textSize: 22,
  fontConstructor: (n: number) => Font.boldSystemFont(n),
  paddingTop: 'md' as RowSize,
  paddingBottom: 'lg' as RowSize,
}
