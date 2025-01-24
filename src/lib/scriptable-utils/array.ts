import { compose, filter, map, toArray, toFind } from './arrayTransducers'
import { ExcludeFalsy, isString } from './common'
import { objectEntries, objectKeys } from './object'
import { ArrCallback, Falsy, MapFn, ObjComparison, ObjKey, PrimitiveType } from './types/utilTypes'

export const isLastArrIndex = (index: number, arr: any[]) => index === arr.length - 1

export const last = <T>(arr: T[]) => arr.at(-1)

/**
 * Vaguely similar to Array.split(), but instead of converting to string, returns array.
 * Will insert `between` between each element in the array (not at beginning or end)
 */
export const insertBetween = <T, U>(arr: T[], between: U) =>
  arr.length < 2 ? arr : arr.flatMap((item, i) => (isLastArrIndex(i, arr) ? item : [item, between]))

export type LengthyArr<T> = [T, ...T[]]

export const hasLength = <T>(arr: T[]): arr is LengthyArr<T> => arr.length > 0

export const isHomogeneous = <T>(arr: T[], isEqual: ObjComparison<T> = (a, b) => a === b) => {
  if (!hasLength(arr)) return true
  if (arr.length === 1) return true
  return arr.slice(1).every((val) => isEqual(val, arr[0]))
}

export const sum = (arr: number[]) => arr.reduce((acc, num) => acc + num, 0)

export const avg = (arr: number[]) => sum(arr) / arr.length

export const uniqueWith = <T>(arr: T[], areEqual: (a: T, b: T) => boolean) =>
  arr.filter((currentEl, i) => !arr.slice(i + 1).some((subsequentEl) => areEqual(currentEl, subsequentEl)))

// Attempt at an efficient intersection algorithm. Inspired by:
// https://stackoverflow.com/questions/497338/efficient-list-intersection-algorithm
export const intersection = <T extends PrimitiveType, U extends PrimitiveType>(arrA: (T | U)[], arrB: (T | U)[]) => {
  const isAShorter = arrA.length < arrB.length
  const compareSet = new Set(isAShorter ? arrA : arrB)
  return (isAShorter ? arrB : arrA).filter((arrEl) => compareSet.has(arrEl))
}

/**
 * Inspired by C.K.:
 *
 * "To get an intersection of a list of lists, you have to look at each item
 * just once, you can basically count the occurance of a given item (by tracking
 * the uniqueness) per list and then take the once which occur as often a you
 * have input lists, that means you can do it in linear time.
 */
export const intersection2 = <T extends ObjKey, U extends ObjKey>(arrA: (T | U)[], arrB: (T | U)[]) => {
  const valueCount = {} as Record<T | U, number>
  for (const value of [...arrA, ...arrB]) {
    valueCount[value] = ((valueCount[value] as number | undefined) ?? 0) + 1
  }
  return toArray(
    objectEntries(valueCount),
    compose(
      filter(([_, count]: [key: T | U, count: number]) => count === 2),
      map(([key]) => key),
    ),
  )
}

/** AKA "complement" in set theory */
export const inANotB = <T, U>(
  a: (T | U)[],
  b: (T | U)[],
  isEqual: (a: T | U, b: T | U) => boolean = (a, b) => a === b,
) => a.filter((aEl) => !b.some((bEl) => isEqual(aEl, bEl)))

const removeFromArr = <T extends PrimitiveType>(arr: T[], item: T) => arr.filter((i) => i !== item)

/** If item is present return arr without it, else return arr with it added. */

export const toggleArrayItem = <T extends PrimitiveType>(
  arr: T[],
  item: T,
  /** If true, ensure item is in arr; if false, ensure it is not. Else, toggle. */
  forceInclude?: boolean,
) => {
  const hasItem = arr.includes(item)
  if (forceInclude === true) return hasItem ? arr : [...arr, item]
  if (forceInclude === false) return hasItem ? removeFromArr(arr, item) : arr
  return hasItem ? removeFromArr(arr, item) : [...arr, item]
}

/** Used in cases where you want an array of all possible values in a
 * string-like type. Using this ensures that TS will complain if it is missing
 * any values. */
export const getTypesafeArrOfType = <T extends string>(valRecord: Record<T, any>) => objectKeys(valRecord)

type ConditionalArr = {
  <T>(arr: (T | Falsy)[]): T[]
  <T>(arr: (T | Falsy)[], joinWith: string): string
}
/** Used in cases when creating an array where some elements may be falsy, then
 * filtering those falsy values out. This provides a typesafe way to get the
 * resulting array */
export const conditionalArr: ConditionalArr = (arr: any[], joinWith?: string): any => {
  const filteredArr = arr.filter(ExcludeFalsy)
  return isString(joinWith) ? filteredArr.join(joinWith) : filteredArr
}

export const isLengthOne = <T>(arr: T[]): arr is [T] => arr.length === 1

/** Combines mapping and finding into a single operation. If no find callback
 * provided, default to Boolean.  */
export const mapFind = <T, U>(arr: T[], mapFn: MapFn<T, U>, find: MapFn<U, any> = Boolean) =>
  toFind(arr, map(mapFn), find)

/** Shorthand for filtering primitive values out of an array. */
export const without = <T extends PrimitiveType>(arr: T[], ...exclude: T[]) => arr.filter((el) => !exclude.includes(el))

export const chunk = <T>(arr: T[], n: number): T[][] => {
  let chunkedArrs = [] as T[][]
  for (const el of arr) {
    const mostRecentChunk = last(chunkedArrs)
    if (!mostRecentChunk) {
      chunkedArrs = [[el]]
      continue
    }
    const isChunkFull = mostRecentChunk.length === n
    chunkedArrs = isChunkFull ? [...chunkedArrs, [el]] : [...chunkedArrs.slice(0, -1), [...mostRecentChunk, el]]
  }
  return chunkedArrs
}

// ts-unused-exports:disable-next-line
export const padArrEnd = <T>(arr: T[], fillTo: number, fill: T) =>
  arr.length >= fillTo ? arr : [...arr, ...Array<T>(fillTo - arr.length).fill(fill)]

/** Akin to `findIndex`, but searches starting from the end of the array. This
 * is a native JS function but my environment isn't up-to-date. */
export const findLastIndex = <T>(
  arr: T[],
  callback: ArrCallback<T>,
  /** Search backwards from which index. Defaults to last */
  searchFromIndex = Math.max(arr.length - 1, 0),
): number => {
  if (arr.length === 0) return -1
  if (searchFromIndex < 0) throw new Error('Invalid index')
  const isMatch = Boolean(callback(arr[searchFromIndex] as T, searchFromIndex, arr))
  if (isMatch) return searchFromIndex
  return searchFromIndex === 0 ? -1 : findLastIndex(arr, callback, searchFromIndex - 1)
}

/** Identical to `Array.findIndex`, but starts looking from a custom index in
 * the array. Returns -1 if not found, else the index (from the original array,
 * not the segment being searched). */
export const findIndexFromIndex = <T>(arr: T[], fromIndex: number, predicate: ArrCallback<T>) => {
  if (fromIndex > arr.length - 1 || fromIndex < 0) return -1
  const segment = arr.slice(fromIndex)
  const indexInSegment = segment.findIndex(predicate)
  return indexInSegment === -1 ? -1 : indexInSegment + fromIndex
}
