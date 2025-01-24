import { composeIdentities } from '../flow'
import { Stream } from '../streams'
import { AnyObj, Identity } from '../types/utilTypes'
import persisted, { Persisted } from './persisted'
import { getTemporaryFilename } from './utils'

type DataObj<M, P> = { inMemoryData: M; persistedData: P }

type SplitData<C, M, P> = (combinedData: C) => DataObj<M, P>

type JoinData<C, M, P> = (data: DataObj<M, P>) => C

type Opts<Combined, InMemory, InPersisted> = {
  defaultData: Combined
  splitData: SplitData<Combined, InMemory, InPersisted>
  joinData: JoinData<Combined, InMemory, InPersisted>
}

/**
 * A persisted cache is a combination of in-memory cache (via a stream) & a
 * persisted cache (via a persisted IO interface).
 *
 * The point of a structure like this is in caching large volumes of data where
 * not all of it needs to be immediately accessible. For example, loading all
 * Inbox threads from Gmail generates a ton of data, the bulk of which is email
 * message bodies. That body data can cached in a file to reduce memory
 * footprint, while the rest is cached in memory.
 *
 * This class basically provides an interface to manage splitting the combined
 * data into memory and persisted, and to access that data in different ways.
 */
export default class PersistedCache<CombinedData, InMemoryData extends AnyObj, InPersistedData> {
  private splitData: SplitData<CombinedData, InMemoryData, InPersistedData>
  private joinData: JoinData<CombinedData, InMemoryData, InPersistedData>
  private io: Persisted<InPersistedData>
  cache$: Stream<InMemoryData>

  constructor({ defaultData, splitData, joinData }: Opts<CombinedData, InMemoryData, InPersistedData>) {
    this.splitData = splitData
    this.joinData = joinData
    const { inMemoryData, persistedData } = splitData(defaultData)
    const filename = getTemporaryFilename()
    this.io = persisted<InPersistedData>({
      filename,
      defaultData: persistedData,
      disableCache: true,
      prettify: false,
    })
    this.cache$ = new Stream<InMemoryData>({
      name: `persisted cache ${filename}`,
      defaultState: inMemoryData,
    })
  }

  /**
   * Returns the stream containing the in-memory cached data for the cache. NB
   * that persisted cache data must be fetched manually! When any change occurs
   * to either in-memory or persisted cache data, this stream will have an
   * update triggered (even though it will not contain the persisted data.)
   */
  get $() {
    return this.cache$
  }

  getInMemoryData() {
    return this.cache$.getData()
  }

  getPersistedData() {
    return this.io.getData()
  }

  async getAllData() {
    return this.joinData({
      inMemoryData: this.getInMemoryData(),
      persistedData: await this.getPersistedData(),
    })
  }

  /**
   * Update the combined data. It is not possible to individually set the in
   * memory and persisted data. The cache$ will have an update triggered for all
   * changes, even to the persisted cache.
   */
  async setData(data: CombinedData) {
    const { inMemoryData, persistedData } = this.splitData(data)
    this.cache$.setData(inMemoryData)
    await this.io.write({ data: persistedData })
    return this.getAllData()
  }

  async updateData(...reducers: Identity<CombinedData>[]) {
    const currData = await this.getAllData()
    const newData = composeIdentities(...reducers)(currData)
    return this.setData(newData)
  }

  cleanup() {
    this.cache$.dangerouslyClearData()
    this.io.deleteFile()
  }
}
