import { safeArrLookup } from './common'
import {
  AnyObj,
  Identity,
  MakeSomeOptional,
  MapFn,
  MaybePromise,
  NoParamFn,
  ObjComparison,
  ReduceCallback,
} from './types/utilTypes'

export const sequentialPromiseAll = async <T>(fns: (() => Promise<T>)[]) => {
  const result: T[] = []
  for (const fn of fns) {
    result.push(await fn())
  }
  return result
}

export const identity = <T>(input: T) => input

/** Composes a sequence of identities into a single identity function. The order
 * identities is applied is preserved. */
export const composeIdentities =
  <D>(...identities: Identity<D>[]): Identity<D> =>
  (initData: D) =>
    identities.reduce((currData, identity) => identity(currData), initData)

export const combineReducers = composeIdentities

export const combineAsyncReducers =
  <D>(...reducers: MapFn<D, MaybePromise<D>>[]): MapFn<D, MaybePromise<D>> =>
  async (initData: D) => {
    let reducedValue = initData
    await sequentialPromiseAll(
      reducers.map((reducer) => async () => {
        const updatedValue = await reducer(reducedValue)

        reducedValue = updatedValue
      }),
    )
    return reducedValue
  }

/** HOF to invert a predicate function */
export const invert =
  <Args extends any[]>(predicate: (...args: Args) => boolean) =>
  (...args: Args) =>
    !predicate(...args)

export const not = (val: any) => !val

/** Given current value & cycle options, return the next option in the cycle */
export const cycle = <T>(currentValue: T, cycleOptions: T[], isEqual: ObjComparison<T> = (a, b) => a === b) => {
  const currIndex = cycleOptions.findIndex((opt) => isEqual(opt, currentValue))
  if (currIndex === -1) {
    console.warn(`Current value ${String(currentValue)} not found in cycle options, returning first option`)
    return safeArrLookup(cycleOptions, 0, 'cycle.1')
  }
  const isLast = currIndex === cycleOptions.length - 1
  return safeArrLookup(cycleOptions, isLast ? 0 : currIndex + 1, 'cycle.2')
}

/** Used in case looking up a record value should possibly be undefined, but TS disagrees */
export const lookup = <K extends string, V>(dict: Record<K, V>, lookupKey: K): V | undefined => dict[lookupKey]

/** More succinct version of writing out an immediately-executing switch block */
export const shortSwitch = <Input extends string | number, Return = Input>(
  input: Input,
  returnMap: Record<Input, Return>,
) => returnMap[input] as Return

export const wait = (ms: number, callback?: () => any) => {
  const t = new Timer()
  t.timeInterval = ms
  return new Promise<void>((resolve) =>
    t.schedule(async () => {
      if (callback) await callback()
      resolve()
    }),
  )
}

//
// Performance measurement
//

type PerformanceMeasurerOpts = {
  name: string
  threshold: number
  metadata?: AnyObj
  /** Notify regardless of threshold */
  logAllMeasurements?: boolean
}
const getPerformanceMeasurers = ({
  name,
  threshold,
  metadata,
  logAllMeasurements = false,
}: PerformanceMeasurerOpts) => {
  let startDate: Date | null = null
  const start = () => {
    startDate = new Date()
  }
  const stop = () => {
    if (!startDate) {
      throw new Error(`Performance timer ${name} stopped before starting.`)
    }
    const duration = Date.now() - startDate.getTime()
    if (duration < threshold && !logAllMeasurements) return

    console.warn(
      JSON.stringify(
        {
          'Performance measure exceeded threshold': name,
          threshold,
          actual: duration,
          metadata,
        },
        null,
        2,
      ),
    )
  }
  return { start, stop }
}

type AsyncMeasure = <R>(
  opts: MakeSomeOptional<PerformanceMeasurerOpts, 'threshold', 'logAllMeasurements'> & {
    fn: NoParamFn<MaybePromise<R>>
  },
) => NoParamFn<Promise<R>>

/** If threshold is provided, will only notify if it is exceeded, else will log
 * the duration every time */
// ts-unused-exports:disable-next-line
export const asyncMeasure: AsyncMeasure =
  ({ name, fn, threshold, metadata }) =>
  async () => {
    const measurer = getPerformanceMeasurers({
      name,
      threshold: threshold || 0,
      metadata,
      logAllMeasurements: !threshold,
    })
    measurer.start()
    const result = await fn()
    measurer.stop()
    return result
  }

type Measure = <R>(
  opts: MakeSomeOptional<PerformanceMeasurerOpts, 'threshold', 'logAllMeasurements'> & { fn: NoParamFn<R> },
) => NoParamFn<R>

/** If threshold is provided, will only notify if it is exceeded, else will log
 * the duration every time */
// ts-unused-exports:disable-next-line
export const measure: Measure =
  ({ name, fn, threshold, metadata }) =>
  () => {
    const measurer = getPerformanceMeasurers({
      name,
      threshold: threshold || 0,
      metadata,
      logAllMeasurements: !threshold,
    })
    measurer.start()
    const result = fn()
    measurer.stop()
    return result
  }

//

/** Returns null if fn call is throttled */
export const throttle = <Args extends any[], R>(fn: (...args: Args) => R, interval = 500) => {
  let mayRun = true
  return (...args: Args) => {
    if (!mayRun) return null
    const timer = new Timer()
    timer.timeInterval = interval
    timer.schedule(() => (mayRun = true))
    mayRun = false
    return fn(...args)
  }
}

export const force = <T>(val: any) => val as unknown as T

export const noop = () => {}

export const asyncReducer = async <SourceArrEl, Final>(
  sourceArr: SourceArrEl[],
  reducer: ReduceCallback<SourceArrEl, Final, MaybePromise<Final>>,
  seed: Final,
): Promise<Final> => {
  let reducedValue = seed
  const setReducedValue = (val: Final) => (reducedValue = val)
  await sequentialPromiseAll(
    sourceArr.map((sourceArrEl, i, arr) => async () => {
      const updatedValue = await reducer(reducedValue, sourceArrEl, i, arr)
      setReducedValue(updatedValue)
    }),
  )
  return reducedValue
}

export const isIn = <T>(element: T, arr: T[], isEqual: ObjComparison<T> = (a, b) => a === b) =>
  arr.some((arrEl) => isEqual(element, arrEl))

// https://stackoverflow.com/questions/39419170/how-do-i-check-that-a-switch-block-is-exhaustive-in-typescript/39419171#39419171
export const assertUnreachable = (x: never): never => {
  throw new Error(`Unexpectedly received value ${String(x as unknown)}`)
}
