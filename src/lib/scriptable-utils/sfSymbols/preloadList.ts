import { without } from '../array'
import { getConfig } from '../configRegister'
import { composeIdentities } from '../flow'
import persisted, { Persisted } from '../io/persisted'
import ThrottledBatchQueue from '../ThrottledBatchQueue'
import { Identity } from '../types/utilTypes'
import { LightDarkKey, SFSymbolKey, TintRequestKey } from './types'
import { getTintRequestKey } from './utils'

/** The persisted data is indexed by script name (from `Script.name()`) and
 * light/dark mode. Each of these permutations will have an array of
 * `TintRequestKey`s that should be preloaded for that script. */
export type IconPreloadListData = Record<string, Record<LightDarkKey, TintRequestKey[]>>

type Reducer = Identity<IconPreloadListData>

type Path = { script: string; mode: LightDarkKey }

//

const getIO = (() => {
  let io: Persisted<IconPreloadListData> | null = null
  return () => {
    if (io) return io
    io = persisted<IconPreloadListData>({
      defaultData: {},
      filename: getConfig('ICON_PRELOAD_LIST_FILENAME'),
    })
    return io
  }
})()

const getDataPath = (): Path => ({
  script: Script.name(),
  mode: Device.isUsingDarkAppearance() ? 'dark' : 'light',
})

/** NB: Order is preserved -- ideally this means that the icons that are loaded
 * immediately in the view are at the beginning of the list. The goal then is to
 * load those first when preloading -- if the design changes much, probably wise
 * to delete the persisted file and rebuild. */
const getAddKeyReducer = (key: TintRequestKey): Reducer => {
  const { script, mode } = getDataPath()
  return (currData) => {
    currData[script] = {
      light: currData[script]?.light ?? [],
      dark: currData[script]?.dark ?? [],
    }
    const currKeys = currData[script]![mode]!
    if (!currKeys.includes(key)) currData[script]![mode]!.push(key)
    return currData
  }
}

const removeExistingKeys = (keys: TintRequestKey[], data: IconPreloadListData) => {
  const { script, mode } = getDataPath()
  const currVals = data[script]?.[mode] ?? []
  return without(keys, ...currVals)
}

const addRequestKeyQueue = new ThrottledBatchQueue<TintRequestKey>({
  batchOperation: async (keys) => {
    const newKeys = removeExistingKeys(keys, await getIO().getData())
    if (newKeys.length > 0) {
      await getIO().reduce(composeIdentities(...newKeys.map(getAddKeyReducer)))
    }
  },
})

//

export const haltTintRequests = () => addRequestKeyQueue.pause()

export const getCurrScriptPreloadIconKeys = async (): Promise<TintRequestKey[]> => {
  const { script, mode } = getDataPath()
  const data = await getIO().getData()
  return data[script]?.[mode] ?? []
}

export const initPreloadListCache = () => getIO().getData()

/** Requires cache instantiation */
export const getScriptNamesInFile = () => Object.keys(getIO().getData({ useCache: true }))

export const deleteScriptNameData = (...scriptNamesToDelete: string[]) =>
  getIO().reduce((data) => {
    const keysInData = Object.keys(data)
    const newData: IconPreloadListData = {}
    for (const key of keysInData) {
      if (!scriptNamesToDelete.includes(key)) newData[key] = data[key]!
    }
    return newData
  })

export const getPreloadListFile$ = () => getIO().cache$

export const throttledLogTintRequest = (iconKey: SFSymbolKey, colorHex: string) =>
  addRequestKeyQueue.push(getTintRequestKey(iconKey, colorHex))
