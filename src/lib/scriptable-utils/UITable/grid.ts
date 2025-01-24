import { sum } from '../array'
import { objectFromEntries } from '../common'
import { isIn } from '../flow'
import { objectEntries } from '../object'
import { Percent } from './Row'
import { parsePercent } from './elements/utils'

type GridKey = string | number | symbol

export type Grid<K extends GridKey> = Record<K, Percent> & GridHelpers<K>

//

const sumPcts = (...percents: Percent[]): Percent => `${sum(percents.map((pct) => parsePercent(pct)))}%`

const gridToNumbers = <Key extends GridKey>(gridWithoutHelpers: Record<Key, Percent>): Record<Key, number> =>
  objectFromEntries(objectEntries(gridWithoutHelpers).map(([key, pct]) => [key, parsePercent(pct)]))

const calculatePcts = <Key extends GridKey>(
  calc: (gridNumbers: Record<Key, number>) => number,
  gridWithoutHelpers: Record<Key, Percent>,
): Percent => {
  const calcNumber = calc(gridToNumbers(gridWithoutHelpers))
  return `${calcNumber}%`
}

type GridHelpers<Key extends GridKey> = {
  sum: (...keys: Key[]) => Percent
  calc: (calcFn: (keyNumValues: Record<Key, number>) => number) => Percent
  extend: <T extends GridKey>(extendedGrid: Record<T, Percent>) => Record<T | Key, Percent> & GridHelpers<T | Key>
}

//

export const getGrid = <T extends Record<GridKey, Percent>>(grid: T): T & GridHelpers<keyof T> => {
  const gridHelpers: GridHelpers<keyof T> = {
    sum: (...keys: (keyof T)[]) => sumPcts(...keys.map((key) => grid[key])),
    calc: (calcFn) => calculatePcts<keyof T>(calcFn, grid),
    extend: (extendedGrid) => getGrid({ ...grid, ...extendedGrid }),
  }

  const reservedKeys = Object.keys(gridHelpers)
  const gridKeys = Object.keys(grid)
  if (reservedKeys.some((reservedKey) => isIn(reservedKey, gridKeys))) {
    throw new Error('Using reserved keys in grid')
  }

  return { ...grid, ...gridHelpers }
}
