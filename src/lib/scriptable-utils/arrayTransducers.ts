import { getSegmentConsts, getSegmentReducer, SegmentRules } from './common'
import { MapFn, PrimitiveType, Typeguard } from './types/utilTypes'

type Reducer<Input, Result> = (result: Result, input: Input, index: number) => Result

type ArrCallbackNoArr<Val, Result> = (value: Val, index: number) => Result

type Joiner<Item, Result> = Reducer<Item, Result>

type Transducer<InitVal = unknown, FinalVal = InitVal> = <Result = unknown>(
  joinData: Joiner<FinalVal, Result>,
) => Reducer<InitVal, Result>

type Compose = {
  /** 1 operator */
  <A, B>(t1: Transducer<A, B>): Transducer<A, B>
  /** 2 operators */
  <A, B, C>(t1: Transducer<A, B>, t2: Transducer<B, C>): Transducer<A, C>
  /** 3 operators */
  <A, B, C, D>(t1: Transducer<A, B>, t2: Transducer<B, C>, t3: Transducer<C, D>): Transducer<A, D>
  /** 4 operators */
  <A, B, C, D, E>(
    t1: Transducer<A, B>,
    t2: Transducer<B, C>,
    t3: Transducer<C, D>,
    t4: Transducer<D, E>,
  ): Transducer<A, E>
  /** 5 operators */
  <A, B, C, D, E, F>(
    t1: Transducer<A, B>,
    t2: Transducer<B, C>,
    t3: Transducer<C, D>,
    t4: Transducer<D, E>,
    t5: Transducer<E, F>,
  ): Transducer<A, F>
  /** 6 operators */
  <A, B, C, D, E, F, G>(
    t1: Transducer<A, B>,
    t2: Transducer<B, C>,
    t3: Transducer<C, D>,
    t4: Transducer<D, E>,
    t5: Transducer<E, F>,
    t6: Transducer<F, G>,
  ): Transducer<A, G>

  /** Any number of transducers w/ the same typing */
  <A, B>(...t: Transducer<A, B>[]): Transducer<A, B>

  /** Unsupported arity! */
  <A, B, C, D, E, F, G>(
    t1: Transducer<A, B>,
    t2: Transducer<B, C>,
    t3: Transducer<C, D>,
    t4: Transducer<D, E>,
    t5: Transducer<E, F>,
    t6: Transducer<F, G>,
    ...rest: Transducer[]
  ): Transducer<A, unknown>
}

//
//
//

export const compose: Compose =
  (...transducers: Transducer[]): Transducer =>
  (joinData) =>
    transducers.reduceRight((accJoinData, transducer) => transducer(accJoinData), joinData)

// OPERATORS

export const map =
  <Init, Mapped>(mapFn: ArrCallbackNoArr<Init, Mapped>): Transducer<Init, Mapped> =>
  (joinData) =>
  (result, input, i) =>
    joinData(result, mapFn(input, i), i)

// ts-unused-exports:disable-next-line
export const flatten =
  <UnflattenedAtom>(): Transducer<(UnflattenedAtom | UnflattenedAtom[])[], UnflattenedAtom[]> =>
  (joinData) =>
  (result, input, i) =>
    joinData(result, input.flat() as UnflattenedAtom[], i)

type Filter = {
  /** Typeguard filter w/ type assertion */
  <Asserted extends Actual, Actual>(predicate: Typeguard<Asserted, Actual>): Transducer<Actual, Asserted>
  /** Boolean filter */
  <T>(predicate: ArrCallbackNoArr<T, any>): Transducer<T>
}
export const filter: Filter =
  <T>(predicate: ArrCallbackNoArr<T, any>): Transducer<T> =>
  (joinData) =>
  (result, input, i) =>
    predicate(input, i) ? joinData(result, input, i) : result

export const tap =
  <T>(callback: ArrCallbackNoArr<T, any>): Transducer<T> =>
  (joinData) =>
  (result, input, i) => {
    callback(input, i)
    return joinData(result, input, i)
  }

/** Returns only the first `take` elements of the transformed array. This is
 * suboptimal, since it should break early if the limit is reached. */
export const take =
  <T>(take: number): Transducer<T> =>
  (joinData) =>
  (result, input, i) =>
    i < take ? joinData(result, input, i) : result

// JOINERS

const joinUnique = <T, U extends PrimitiveType>(getCompareVal: MapFn<T, U>): Joiner<T, T[]> => {
  const hasSeen = new Set<U>()
  return (acc, val) => {
    const compareVal = getCompareVal(val)
    if (hasSeen.has(compareVal)) return acc
    hasSeen.add(compareVal)
    return [...acc, val]
  }
}

const sum = (i: number, j: number) => i + j
const joinSum = (): Joiner<number, number> => sum

const inc = (i: number) => i + 1
const joinCount = (): Joiner<any, number> => inc

const joinReduce = <Result, Value>(reduce: Reducer<Value, Result>): Joiner<Value, Result> => reduce

const setAdd = <T>(set: Set<T>, val: T) => set.add(val)
const joinSet = <T>(): Joiner<T, Set<T>> => setAdd

const joinFind =
  <T>(isMatch: MapFn<T, any>): Joiner<T, T | undefined> =>
  (acc, val) =>
    acc || (isMatch(val) ? val : acc)

const concat = <T>(arr: T[], val: T | T[]) => [...arr, ...(Array.isArray(val) ? val : [val])]
const joinConcat = <T>(): Joiner<T | T[], T[]> => concat

const flat = <T>(acc: T[], val: (T | T[])[]) => [...acc, ...(val.flat() as T[])]
const joinFlat = <T>(): Joiner<(T | T[])[], T[]> => flat

// EXECUTORS

/** Returns an array resulting from given transformation */
export const toArray = <Init, Final>(sourceData: Init[], xform: Transducer<Init, Final | Final[]>) =>
  sourceData.reduce(xform(joinConcat()), [])

export const toUniqueArray = <Init, Final, CompareVal extends PrimitiveType>(
  sourceData: Init[],
  xform: Transducer<Init, Final>,
  getCompareVal: MapFn<Final, CompareVal> = (x) => x as unknown as CompareVal,
) => sourceData.reduce(xform(joinUnique(getCompareVal)), [])

/** Returns sum of transformed array */
// ts-unused-exports:disable-next-line
export const toSum = <T>(sourceData: T[], xform: Transducer<T, number>) => sourceData.reduce(xform(joinSum()), 0)

/** Returns count of transformed array */
export const toCount = <T>(sourceData: T[], xform: Transducer<T, any>) => sourceData.reduce(xform(joinCount()), 0)

/** Transform the source data with a given transducer (`xform`), then reduce
 * that into another entity. This will only traverse the array once. */
export const toReduce = <Init, Final, ReduceResult>(
  sourceData: Init[],
  xform: Transducer<Init, Final>,
  reduce: Reducer<Final, ReduceResult>,
  reduceSeed: ReduceResult,
) => sourceData.reduce(xform(joinReduce(reduce)), reduceSeed)

export const toSegmented = <Init, Final, RuleKey extends string>(
  sourceData: Init[],
  xform: Transducer<Init, Final>,
  segmentRules: SegmentRules<RuleKey, Final>,
) => sourceData.reduce(xform(getSegmentReducer(segmentRules)), getSegmentConsts(segmentRules).seed)

export const toSet = <Init, Final extends PrimitiveType>(sourceData: Init[], xform: Transducer<Init, Final>) =>
  sourceData.reduce(xform(joinSet()), new Set())

export const toFind = <Init, Final>(sourceData: Init[], xform: Transducer<Init, Final>, isMatch: MapFn<Final, any>) =>
  sourceData.reduce(xform(joinFind(isMatch)), undefined)

export const toPromiseAll = <Init, Final extends Promise<any>>(sourceData: Init[], xform: Transducer<Init, Final>) =>
  Promise.all(sourceData.reduce(xform(joinConcat()), []))

// ts-unused-exports:disable-next-line
export const toFlat = <Init, Final>(sourceData: Init[], xform: Transducer<Init, (Final | Final[])[]>) =>
  sourceData.reduce(xform(joinFlat()), [])
