// Home for utils that are required by other util files, to avoid circular dependency issues.
// Also home for random utils that don't fit elsewhere.

import { AnyObj, Falsy, MapFn, NotUndefined } from './types/utilTypes'

//
// TYPEGUARDS / TYPE UTILS
//

export const isNumber = (val: any): val is number => Number.isFinite(val)

const isDate = (val: any): val is Date => val instanceof Date || Object.prototype.toString.call(val) === '[object Date]'

export const isString = (val: any): val is string => typeof val === 'string' || val instanceof String

export const isNullish = (val: any): val is null | undefined => val === undefined || val === null

const isRegExp = (val: any): val is RegExp =>
  val instanceof RegExp || Object.prototype.toString.call(val) === '[object RegExp]'

// https://stackoverflow.com/questions/47632622/typescript-and-filter-boolean
export const ExcludeFalsy = Boolean as any as <T>(x: T | Falsy) => x is T

/** For types that may be undefined or some other value, this  */
export const isNotUndefined = <T>(val: T): val is NotUndefined<T> => val !== undefined

export const isFunc = (val: any): val is (...args: any[]) => any => typeof val === 'function'

export const isBoolean = (val: any): val is boolean => typeof val === 'boolean'

//
//
//

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ty = (val: any) => typeof val
type NativeTypes = ReturnType<typeof ty>
/** Custom types returned in getType */
type GranularTypes = 'array' | 'date' | 'regexp' | 'map' | 'set' | 'null'
type GetTypeTypes = NativeTypes | GranularTypes

/** Extended, more granular version of typeof */
export const getType = (el: any): GetTypeTypes => {
  if (el === null) return 'null'
  if (Array.isArray(el)) return 'array'
  if (isDate(el)) return 'date'
  if (isString(el)) return 'string'
  if (isRegExp(el)) return 'regexp'
  if (el instanceof Map) return 'map'
  if (el instanceof Set) return 'set'
  return typeof el
}

export const isObject = (val: any): val is AnyObj => getType(val) === 'object'

export const clamp = (number: number, min: number, max: number) => Math.min(Math.max(number, min), max)

export const getRandomArrayItem = <T>(arr: T[]) =>
  safeArrLookup(arr, Math.floor(Math.random() * arr.length), 'getRandomArrayItem')

const to2DigitHex = (n: number) => {
  const parsedN = clamp(Math.round(n), 0, 255)
  const hexValue = parsedN.toString(16)
  const prefix = hexValue.length < 2 ? '0' : ''
  return prefix + hexValue
}

/**
 * https://stackoverflow.com/questions/21034924/lighten-hex-code-in-javascript
 * When `change` is negative, the color is darkened; -1 always yields black.
 * When `change` is positive, the color is lightened, 1 always yields white.
 * Finally, 0 always yields the original color.
 */
const shade = (colorObj: Color, change: number) => {
  const { hex } = colorObj
  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)

  const darkenTransform = (n: number) => to2DigitHex((1 + change) * n)
  const lightenTransform = (n: number) => to2DigitHex((1 - change) * n + change * 255)
  const isDarkening = change < 0

  return new Color([r, g, b].map(isDarkening ? darkenTransform : lightenTransform).join(''))
}

const darken = (colorObj: Color, change = 0.4) => {
  const parsedChange = change < 0 ? change : change * -1
  return shade(colorObj, parsedChange)
}

const lighten = (colorObj: Color, change = 0.4) => {
  const parsedChange = change < 0 ? change * -1 : change
  return shade(colorObj, parsedChange)
}

export const fade = (color: Color, change = 0.4) => (Device.isUsingDarkAppearance() ? darken : lighten)(color, change)

export const getBookmarkedPath = (bookmarkName: string) => {
  const f = FileManager.iCloud()
  // File bookmark doesn't exist on this device.
  return f.bookmarkExists(bookmarkName) ? f.bookmarkedPath(bookmarkName) : null
}

export class ErrorWithPayload extends Error {
  payload: AnyObj
  constructor(message: string, payload: AnyObj) {
    super(message)
    this.payload = payload
  }
}

export const safeArrLookup = <T extends NotUndefined<any>>(arr: T[], index: number, callingFn: string) => {
  const val = arr[index]
  if (val === undefined) {
    const errorMsg = `Array lookup failed in "${callingFn}", no value at index ${index}`

    console.error(errorMsg)
    throw new ErrorWithPayload(errorMsg, { arr })
  }
  return val
}

/** Get existent and not-undefined value from an object + key */
export const safeObjLookup = <K extends string | number, O extends Record<K, NotUndefined<any>>>(
  obj: O,
  key: K,
  callingFn: string,
) => {
  if (!Object.hasOwn(obj, key)) {
    const errorMsg = `Object lookup failed in "${callingFn}", key "${key}" does not exist`

    console.error(errorMsg)
    throw new ErrorWithPayload(errorMsg, { obj })
  }
  const val = obj[key]
  if (val === undefined) {
    const errorMsg = `Object lookup failed in "${callingFn}", value of key "${key}" is undefined.`

    console.error(errorMsg)
    throw new ErrorWithPayload(errorMsg, { obj })
  }
  return val as NotUndefined<O[K]>
}

export const objectFromEntries = <K extends string | number | symbol, V>(entries: [key: K, val: V][]) =>
  Object.fromEntries(entries) as Record<K, V>

export type SegmentRules<RuleKey extends string, T> = Record<RuleKey, ((item: T) => boolean) | 'UNMATCHED'>

export const getSegmentConsts = <RuleKey extends string, T>(segmentRules: SegmentRules<RuleKey, T>) => {
  const segmentKeys = Object.keys(segmentRules) as RuleKey[]
  return {
    segmentKeys,
    unmatchedRuleKeys: segmentKeys.filter((k) => segmentRules[k] === 'UNMATCHED'),
    seed: objectFromEntries(segmentKeys.map((key) => [key, [] as T[]])),
  }
}

export const getSegmentReducer = <T, K extends string>(
  segmentRules: SegmentRules<K, T>,
): ((acc: Record<K, T[]>, item: T) => Record<K, T[]>) => {
  const { segmentKeys, unmatchedRuleKeys } = getSegmentConsts(segmentRules)
  return (acc, item) => {
    const matchingRuleKeys = segmentKeys.filter((key) => {
      const segmentRule = segmentRules[key]
      return isFunc(segmentRule) ? segmentRule(item) : false
    })
    if (matchingRuleKeys.length > 0) {
      for (const k of matchingRuleKeys) acc[k].push(item)
    } else if (unmatchedRuleKeys.length > 0) {
      for (const k of unmatchedRuleKeys) acc[k].push(item)
    }
    return acc
  }
}

/**
 * Given an array of items<T> & rules for segment membership, return segmented object of T[].
 * Segment rules should be a predicate for type T, or string 'UNMATCHED' to serve as catch-all.
 * Array entities can belong to multiple segments.
 */
export const segment = <T, K extends string>(arr: T[], segmentRules: SegmentRules<K, T>): Record<K, T[]> =>
  arr.reduce(getSegmentReducer(segmentRules), getSegmentConsts(segmentRules).seed)

type GroupBy = {
  <ArrVal, Key>(
    arr: ArrVal[],
    getGroupKey: MapFn<ArrVal, Key>,
  ): {
    key: Key
    val: ArrVal[]
  }[]
  <ArrVal, Key, GroupedVal>(
    arr: ArrVal[],
    getGroupKey: MapFn<ArrVal, Key>,
    mapVal: MapFn<ArrVal, GroupedVal>,
  ): { key: Key; val: GroupedVal[] }[]
}
/**
 * Group array values by a common characteristic. Combined values are returned
 * in an array
 *
 * Example:
 * ```
 * groupBy(
 *   [
 *     { label: 'hiya', val: 1 },
 *     { label: 'hiya', val: 2 },
 *     { label: 'hey there', val: 3 },
 *     { label: 'hiya', val: 1 },
 *   ],
 *   ({ label }) => label,
 *   ({ val }) => val
 * );
 * ```
 *
 * Returns:
 * ```
 * [
 *   { key: 'hiya', val: [1, 2, 1] },
 *   { key: 'hey there', val: [3] },
 * ]
 * ```
 *
 */
export const groupBy: GroupBy = <ArrVal, GroupedVal>(
  arr: ArrVal[],
  getGroupKey: MapFn<ArrVal>,
  mapVal?: MapFn<ArrVal, GroupedVal>,
) => {
  let result: { key: unknown; val: unknown[] }[] = []
  for (const arrVal of arr) {
    const key = getGroupKey(arrVal)
    const val = mapVal ? mapVal(arrVal) : arrVal
    let wasAlreadyInAcc = false
    const mappedAcc = result.map((accVal) => {
      if (accVal.key !== key) return accVal
      wasAlreadyInAcc = true
      return { key, val: [...accVal.val, val] }
    })
    if (!(wasAlreadyInAcc as boolean)) mappedAcc.push({ key, val: [val] })
    result = mappedAcc
  }
  return result
}
