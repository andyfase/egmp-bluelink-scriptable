import ThrottledBatchQueue from '../ThrottledBatchQueue'
import { AnyObj, Identity, StreamCallback } from '../types/utilTypes'
import { StreamConstructorOpts } from './types'

type UpdateCallback<D extends AnyObj> = (previousData: D, updatedData: D) => any
type CallbackWithOpts<D extends AnyObj> = {
  id: string
  callback: UpdateCallback<D>
}

type RegisterUpdateCallbackOpts<D extends AnyObj> = {
  callback: UpdateCallback<D>
  /** Optionally provide a unique string ID to ensure the same callback is not
   * added multiple times. */
  callbackId: string
  /** If ID provided, by default existing callback w/ that ID will be
   * overwritten. If set to false, first callback set will remain. */
  overwriteExistingCallback?: boolean
}

type UpdateDataPayload<T> = {
  reducer: Identity<T>
  suppressChangeTrigger: boolean
}

export default class Stream<DataType extends AnyObj> {
  private name: string
  private showStreamDataUpdateDebug: boolean
  private data: DataType
  private updateCallbacks: CallbackWithOpts<DataType>[] = []
  // Queue to sequentially update data
  private updateQueue: ThrottledBatchQueue<UpdateDataPayload<DataType>>

  constructor({ defaultState, name, showStreamDataUpdateDebug = false }: StreamConstructorOpts<DataType>) {
    this.showStreamDataUpdateDebug = showStreamDataUpdateDebug
    this.data = defaultState
    this.name = name
    this.updateCallbacks = []

    this.updateQueue = new ThrottledBatchQueue({
      interval: 0,
      maxEntitiesPerOperation: 1,
      batchOperation: ([{ reducer, suppressChangeTrigger }]) => {
        const oldData = { ...this.data }
        const newData = reducer(oldData)
        this.data = newData
        if (!suppressChangeTrigger) this.runCallbacks(oldData, newData)
      },
    })
  }

  registerUpdateCallback({
    callback,
    callbackId,
    overwriteExistingCallback = true,
  }: RegisterUpdateCallbackOpts<DataType>): StreamCallback {
    const callbackIdAlreadyRegistered = this.updateCallbacks.some(({ id }) => id === callbackId)
    const overwriteDisallowed = callbackIdAlreadyRegistered && !overwriteExistingCallback

    if (!overwriteDisallowed)
      this.updateCallbacks = [
        ...this.updateCallbacks.filter(({ id }) => id !== callbackId),
        { callback, id: callbackId },
      ]

    return { remove: () => this.unregisterUpdateCallback(callbackId) }
  }

  unregisterUpdateCallback(callbackId: string) {
    this.updateCallbacks = this.updateCallbacks.filter(({ id }) => id !== callbackId)
  }

  private runCallbacks(previousData: DataType, updatedData: DataType) {
    for (const { callback, id } of this.updateCallbacks) {
      if (this.showStreamDataUpdateDebug) console.log(`Running stream "${this.name}" update callback with ID "${id}"`)
      callback(previousData, updatedData)
    }
  }

  /** Reduce stream data */
  updateData(reducer: Identity<DataType>, { suppressChangeTrigger = false } = {}) {
    this.updateQueue.push({ reducer, suppressChangeTrigger })
  }

  /** Set full stream data */
  setData(data: DataType, { suppressChangeTrigger = false } = {}) {
    return this.updateData(() => data, { suppressChangeTrigger })
  }

  /** Update a single attribute of stream data */
  updateAttr<K extends keyof DataType>(key: K, val: DataType[K], { suppressChangeTrigger = false } = {}) {
    return this.updateData((data) => ({ ...data, [key]: val }), {
      suppressChangeTrigger,
    })
  }

  /** Used to trigger callbacks when no change has occurred */
  triggerChange() {
    return this.runCallbacks(this.data, this.data)
  }

  getData() {
    return this.data
  }

  /** This is dangerous because a stream is assumed to never be empty. This
   * should only be used before exiting the script, or if you know that you
   * won't use this stream again before the script ends. */
  dangerouslyClearData() {
    this.data = {} as DataType
  }
}
