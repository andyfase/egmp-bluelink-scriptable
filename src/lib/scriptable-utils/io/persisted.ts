import { isString } from '../common'
import { getConfig } from '../configRegister'
import { objectKeys } from '../object'
import Stream from '../streams/Stream'
import { AnyObj, ArrCallback, Identity, ObjComparison, UnwrapArr } from '../types/utilTypes'

export type CreateIObjectOpts<T> = {
  filename: string
  defaultData: T
  directory?: string
  fileExtension?: string
  prettify?: boolean
  areEntitiesEqual?: T extends any[] ? ObjComparison<UnwrapArr<T>> : undefined
  disableCache?: boolean
}

export type Cache$Data<T> = { data: T }

type IOObject<T> = Pick<Required<CreateIObjectOpts<T>>, 'prettify' | 'defaultData' | 'areEntitiesEqual'> & {
  io: FileManager
  path: string
  /** Cache can be disabled, default is enabled. This can be useful when trying
   * to avoid storing large amounts of data in memory. */
  cache$: Stream<Cache$Data<T>> | null
}

const USE_CACHE_DEFAULT = false

//

const createIOObject = <T>({
  filename,
  defaultData,
  directory = getConfig('SCRIPTABLE_STORE_PATH'),
  fileExtension = 'txt',
  prettify = true,
  areEntitiesEqual = basicEquality,
  disableCache = false,
}: CreateIObjectOpts<T>): IOObject<T> => ({
  io: FileManager.iCloud(),
  path: `${directory}/${filename}.${fileExtension}`,
  prettify,
  defaultData,
  cache$: disableCache
    ? null
    : new Stream<Cache$Data<T>>({
        name: `persisted cache ${filename}`,
        defaultState: { data: defaultData },
      }),
  areEntitiesEqual: areEntitiesEqual as any,
})

const _download = async <T>({ io, path }: IOObject<T>) => {
  if (!io.isFileDownloaded(path)) await io.downloadFileFromiCloud(path)
}

const _getPersistedJson = async <T>(ioObj: IOObject<T>) => {
  const { io, path, defaultData } = ioObj
  if (!io.fileExists(path)) return null
  await _download(ioObj)
  const rawString = io.readString(path)
  return isString(defaultData) ? (rawString as any as T) : (JSON.parse(rawString) as T)
}

//

type MaybePromiseWithPayload<R, P extends AnyObj> = {
  /** Use cache */
  (opts: P & { useCache: true }): R
  /** Do not use cache, fetch fresh (default) */
  (opts: P & { useCache?: false }): Promise<R>
}

type MaybePromiseWithoutPayload<R> = {
  /** Do not use cache, fetch fresh (default) */
  (opts?: { useCache?: false }): Promise<R>
  /** Use cache */
  (opts: { useCache: true }): R
}

type GetData<T> = MaybePromiseWithoutPayload<T>
const getGetData = <T>(ioObj: IOObject<T>) =>
  (({
    useCache = USE_CACHE_DEFAULT,
    suppressChangeTrigger = false,
  }: { useCache?: boolean; suppressChangeTrigger?: boolean } = {}): unknown => {
    const { cache$, defaultData } = ioObj
    if (useCache) {
      if (!cache$) {
        throw new Error('Attempting to get data with cache, but cache is disabled.')
      }
      return cache$.getData().data
    }
    return new Promise((resolve) => {
      _getPersistedJson(ioObj).then((persistedData) => {
        const parsedData = persistedData ?? defaultData
        if (cache$) {
          cache$.setData({ data: parsedData }, { suppressChangeTrigger })
        }
        resolve(parsedData)
      })
    })
  }) as GetData<T>

const _fetchData = <T>(ioObj: IOObject<T>) => getGetData(ioObj)()
const _getCachedData = <T>(ioObj: IOObject<T>) => getGetData(ioObj)({ useCache: true })

type Write<T> = (opts: { data: T }) => Promise<T>
const getWrite =
  <T>(ioObj: IOObject<T>): Write<T> =>
  async ({ data }) => {
    await _download(ioObj)
    const { path, prettify, io, defaultData, cache$ } = ioObj
    io.writeString(
      path,
      isString(defaultData) ? (data as unknown as string) : JSON.stringify(data, null, prettify ? 2 : undefined),
    )
    if (cache$) {
      cache$.setData({ data })
    }
    return data
  }

const _write = <T>(ioObj: IOObject<T>, data: T) => getWrite(ioObj)({ data })

type DeleteFile = () => void
const getDeleteFile =
  (ioObj: IOObject<any>): DeleteFile =>
  () =>
    ioObj.io.remove(ioObj.path)

type Reset<T> = () => Promise<T>
/** Reset to default data */
const getReset =
  <T>(ioObj: IOObject<T>): Reset<T> =>
  () =>
    _write(ioObj, ioObj.defaultData)

type Reduce<T> = (reducer: Identity<T>) => Promise<void>
const getReduce =
  <T>(ioObj: IOObject<T>): Reduce<T> =>
  async (reducer) => {
    const currData = await _fetchData(ioObj)
    await _write(ioObj, reducer(currData))
  }

//

const fnWithCacheOpts = <T, R, P extends AnyObj = AnyObj>(
  ioObj: IOObject<T>,
  getResponse: (opts: { currData: T } & P) => R,
) =>
  (({ useCache = USE_CACHE_DEFAULT, ...payload }: any) => {
    if (useCache) {
      const currData = _getCachedData(ioObj)
      return getResponse({ currData, ...payload })
    }
    return new Promise((resolve) =>
      _fetchData(ioObj).then((currData) => resolve(getResponse({ currData, ...payload }))),
    )
  }) as MaybePromiseWithPayload<R, P>

// Array/set functions

type ItemPayload<T> = { item: T }

const basicEquality = <T>(a: T, b: T) => a === b

const arrHasItem = <T extends any[]>(arr: T, item: UnwrapArr<T>, { areEntitiesEqual }: IOObject<T>) =>
  arr.some((i) => areEntitiesEqual(i, item))

type Has<T> = MaybePromiseWithPayload<boolean, ItemPayload<T>>
const getHas = <T>(ioObj: IOObject<T[]>): Has<T> =>
  fnWithCacheOpts<T[], boolean, ItemPayload<T>>(ioObj, ({ currData, item }) => arrHasItem(currData, item, ioObj))

type Add<T> = (opts: ItemPayload<T>) => Promise<void>
const getAdd =
  <T>(ioObj: IOObject<T[]>): Add<T> =>
  async ({ item }) => {
    const currData = await _fetchData(ioObj)
    if (arrHasItem(currData, item, ioObj)) return
    await _write(ioObj, [...currData, item])
  }

type Concat<T> = (opts: { items: T[] | T }) => Promise<void>
const getConcat =
  <T>(ioObj: IOObject<T[]>): Concat<T> =>
  async ({ items }) => {
    const currData = await _fetchData(ioObj)
    const parsedArr = Array.isArray(items) ? items : [items]
    const newItems = parsedArr.filter((item) => !arrHasItem(currData, item, ioObj))
    if (newItems.length === 0) return
    await _write(ioObj, [...currData, ...newItems])
  }

type Delete<T> = (opts: ItemPayload<T>) => Promise<void>
const getDelete =
  <T>(ioObj: IOObject<T[]>): Delete<T> =>
  async ({ item }) => {
    const currData = await _fetchData(ioObj)
    await _write(
      ioObj,
      currData.filter((i) => !ioObj.areEntitiesEqual(i, item)),
    )
  }

type Find<T> = MaybePromiseWithPayload<T | undefined, { predicate: ArrCallback<T> }>
const getFind = <T>(ioObj: IOObject<T[]>): Find<T> =>
  fnWithCacheOpts(ioObj, ({ currData, predicate }) => currData.find(predicate))

type Some<T> = MaybePromiseWithPayload<boolean, { predicate: ArrCallback<T> }>
const getSome = <T>(ioObj: IOObject<T[]>): Some<T> =>
  fnWithCacheOpts(ioObj, ({ currData, predicate }) => currData.some(predicate))

type _Map<T> = (mapFn: ArrCallback<T, T>) => Promise<void>
const getMap =
  <T>(ioObj: IOObject<T[]>): _Map<T> =>
  async (mapFn) => {
    const currData = await _fetchData(ioObj)
    const newData = currData.map(mapFn)
    await _write(ioObj, newData)
  }

type Filter<T> = (predicate: ArrCallback<T>) => Promise<void>
const getFilter =
  <T>(ioObj: IOObject<T[]>): Filter<T> =>
  async (predicate) => {
    const currData = await _fetchData(ioObj)
    await _write(ioObj, currData.filter(predicate))
  }

// Object functions

type HasKey<T> = MaybePromiseWithPayload<boolean, { key: keyof T }>
const getHasKey = <T extends AnyObj>(ioObj: IOObject<T>): HasKey<T> =>
  fnWithCacheOpts(ioObj, ({ currData, key }) => objectKeys(currData).includes(key))

type Get<T, K extends keyof T = keyof T> = MaybePromiseWithPayload<T[K] | undefined, { key: K }>
const getGet = <T, K extends keyof T>(ioObj: IOObject<T>): Get<T, K> =>
  fnWithCacheOpts(ioObj, ({ currData, key }) => currData[key])

type Set<T, K extends keyof T = keyof T> = (opts: { key: K; value: T[K] }) => Promise<void>
const getSet =
  <T, K extends keyof T>(ioObj: IOObject<T>): Set<T, K> =>
  async ({ key, value }) => {
    const currData = await _fetchData(ioObj)
    ;(currData as T)[key] = value
    await _write(ioObj, currData)
  }

type ObjKeyDelete<T, K extends keyof T = keyof T> = (key: K) => Promise<void>
const getObjKeyDelete =
  <T, K extends keyof T>(ioObj: IOObject<T>): ObjKeyDelete<T, K> =>
  async (key) => {
    const currData = await _fetchData(ioObj)

    delete currData[key]
    await _write(ioObj, currData)
  }

//

export type Persisted<T> = {
  cache$: Stream<Cache$Data<T>>
  getData: GetData<T>
  write: Write<T>
  reset: Reset<T>
  reduce: Reduce<T>
  deleteFile: DeleteFile
} & (T extends any[]
  ? {
      has: Has<UnwrapArr<T>>
      add: Add<UnwrapArr<T>>
      concat: Concat<UnwrapArr<T>>
      delete: Delete<UnwrapArr<T>>
      find: Find<UnwrapArr<T>>
      some: Some<UnwrapArr<T>>
      map: _Map<UnwrapArr<T>>
      filter: Filter<UnwrapArr<T>>
    }
  : T extends AnyObj
    ? {
        hasKey: HasKey<T>
        get: Get<T>
        set: Set<T>
        deleteObjKey: ObjKeyDelete<T>
      }
    : AnyObj)

const persisted = <T>(opts: CreateIObjectOpts<T>): Persisted<T> => {
  const ioObject = createIOObject(opts)
  return {
    cache$: ioObject.cache$,
    getData: getGetData(ioObject),
    write: getWrite(ioObject),
    reset: getReset(ioObject),
    reduce: getReduce(ioObject),
    deleteFile: getDeleteFile(ioObject as any),

    // Array-specific functions
    has: getHas(ioObject as any),
    add: getAdd(ioObject as any),
    concat: getConcat(ioObject as any),
    delete: getDelete(ioObject as any),
    find: getFind(ioObject as any),
    some: getSome(ioObject as any),
    map: getMap(ioObject as any),
    filter: getFilter(ioObject as any),

    // Object-specific functions
    hasKey: getHasKey(ioObject as any),
    get: getGet(ioObject),
    set: getSet(ioObject),
    deleteObjKey: getObjKeyDelete(ioObject),
  } as unknown as Persisted<T>
}
export default persisted
