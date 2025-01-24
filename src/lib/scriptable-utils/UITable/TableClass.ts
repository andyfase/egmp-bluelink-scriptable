import { ExcludeFalsy } from '../common'
import { Persisted } from '../io/persisted'
import RepeatingTimer from '../RepeatingTimer'
import { getIconPreloadHelpers } from '../sfSymbols'
import { Stream } from '../streams'
import { AnyObj, NoParamFn } from '../types/utilTypes'
import {
  AfterFirstRender,
  AfterPropsLoad,
  BeforeEveryRender,
  BeforeLoad,
  Connected$Opts,
  GetRows,
  LoadProps,
  OnConnected$Update,
  OnDismiss,
  OnSecondRender,
  Payload$,
  RenderCount,
  SetRenderOpts,
  TableOpts,
} from './types'
import { catchTableError, reloadTableRows } from './utils'

type GetConnected$PollerOpts<$Data extends AnyObj> = {
  connected$: Connected$Opts<$Data>
  onUpdate: NoParamFn
  tableName: string
}
class Connected$Poller<$Data extends AnyObj> {
  private connected$: Stream<$Data>
  private hasQueuedUpdate: boolean = false
  private timer: RepeatingTimer
  private callbackId: string

  constructor({ connected$, onUpdate, tableName }: GetConnected$PollerOpts<$Data>) {
    const { $, ...timerOpts } = connected$
    this.connected$ = $ as Stream<$Data>
    this.callbackId = `Connected$ for table: ${tableName}`
    this.timer = new RepeatingTimer({
      ...timerOpts,
      onFire: () => {
        if (this.hasQueuedUpdate) {
          this.hasQueuedUpdate = false
          onUpdate()
        }
      },
    })
  }

  start() {
    this.connected$.registerUpdateCallback({
      callbackId: this.callbackId,
      callback: () => (this.hasQueuedUpdate = true),
    })
    this.timer.start()
  }

  cleanup() {
    this.timer.stop()
    this.connected$.unregisterUpdateCallback(this.callbackId)
  }
}

//

type CallbackKey = 'connected$Poller' | 'payload$' | 'persistedState$Poller' | 'syncedPersistedState' | 'iconPreloading'
type RegisteredCallback = Record<'start' | 'cleanup', NoParamFn>

/** Entities like streams & timers are registered to ensure that they are
 * properly setup and cleaned up at the appropriate times. */
class CallbackRegister {
  private register: Record<CallbackKey, Partial<RegisteredCallback>> = {
    connected$Poller: {},
    payload$: {},
    persistedState$Poller: {},
    syncedPersistedState: {},
    iconPreloading: {},
  }
  set(key: CallbackKey, start: NoParamFn, cleanup: NoParamFn) {
    this.register[key].start = start
    this.register[key].cleanup = cleanup
  }
  start(key: CallbackKey) {
    this.register[key].start?.()
  }
  cleanupAll() {
    for (const { cleanup } of Object.values(this.register)) cleanup?.()
  }
}

//

export class Table<State, Props, $Data extends AnyObj | undefined> {
  private table = new UITable()
  // Don't store connected$ props in this stream, since  we will be duplicating
  // potentially huge amounts of data in the table. Rather, update the
  // `connected$ChangeCount` attribute with any stream change, thus triggering
  // changes for any callbacks/subscriptions to this stream. Use `getProps` to
  // access the combined props.
  private payload$: Payload$<State, Props>
  private name: string
  private callbackID: string
  private isActive = false
  private fullscreen: boolean
  private callbackRegister = new CallbackRegister()
  private syncedPersistedState?: Persisted<State>
  private beforeLoad?: BeforeLoad
  private beforeEveryRender?: BeforeEveryRender
  private afterPropsLoad?: AfterPropsLoad
  private afterFirstRender?: AfterFirstRender
  private onSecondRender?: OnSecondRender
  private connected$?: $Data extends AnyObj ? Connected$Opts<$Data> : never
  has: {
    state: boolean
    props: boolean
    runPrerenderCallbacks: boolean
  }
  private renderCount: RenderCount = 'NONE'
  private defaultState?: State
  private loadProps?: LoadProps<Props>
  private getRows?: GetRows
  private onDismiss?: OnDismiss
  private onConnected$Update?: OnConnected$Update<$Data>

  constructor({
    name,
    showSeparators = false,
    fullscreen = false,
    beforeEveryRender,
    payload$,
    syncedPersistedState,
    connected$,
  }: TableOpts<State, Props, $Data>) {
    this.table.showSeparators = showSeparators
    this.name = name
    this.fullscreen = fullscreen
    this.syncedPersistedState = syncedPersistedState
    this.beforeEveryRender = beforeEveryRender
    this.payload$ = payload$
    this.connected$ = connected$
    this.has = {
      state: Boolean(syncedPersistedState),
      // Determined when `setRenderOpts` is called
      props: false,
      runPrerenderCallbacks: false,
    }
    this.callbackID = `Table: ${name}`

    if (connected$) {
      const connected$Poller = new Connected$Poller({
        connected$,
        tableName: name,
        onUpdate: () => {
          const updated$Data = connected$.$.getData()
          this.payload$.updateData(({ connected$ChangeCount, ...rest }) => ({
            connected$ChangeCount: (connected$ChangeCount || 0) + 1,
            ...rest,
          }))
          this.onConnected$Update?.(updated$Data as $Data)
        },
      })
      this.callbackRegister.set(
        'connected$Poller',
        () => connected$Poller.start(),
        () => connected$Poller.cleanup(),
      )
    }

    this.callbackRegister.set(
      'payload$',
      () =>
        this.payload$.registerUpdateCallback({
          callback: () => this.renderTable(),
          callbackId: this.callbackID,
        }),
      () => {
        this.payload$.unregisterUpdateCallback(this.callbackID)
        this.payload$.setData({}, { suppressChangeTrigger: true })
      },
    )

    this.callbackRegister.set(
      'syncedPersistedState',
      () =>
        this.syncedPersistedState?.cache$.registerUpdateCallback({
          callbackId: this.callbackID,
          callback: (updatedData) => this.payload$.updateAttr('state', updatedData.data),
        }),
      () => this.syncedPersistedState?.cache$.unregisterUpdateCallback(this.callbackID),
    )

    const { preloadIcons, haltIconPreload } = getIconPreloadHelpers(() => this.isActive && this.renderTable())
    this.callbackRegister.set('iconPreloading', preloadIcons, haltIconPreload)
  }

  isTableActive() {
    return this.isActive
  }

  setState(partialState: Partial<State>) {
    const currState = this.payload$.getData().state
    if (!currState) throw new Error('Setting state without initialized state')
    const updatedState = { ...currState, ...partialState } as State
    this.payload$.updateAttr('state', updatedState)
    this.syncedPersistedState?.reduce((data) => ({ ...data, ...updatedState }))
  }

  setRenderOpts({
    loadProps,
    render,
    defaultState,
    onDismiss,
    beforeLoad,
    afterPropsLoad,
    afterFirstRender,
    onSecondRender,
    onConnected$Update,
    shouldPreloadIcons,
  }: SetRenderOpts<State, Props, $Data>) {
    this.has.state = this.has.state || Boolean(defaultState)
    this.has.props = Boolean(loadProps || this.connected$)
    this.defaultState = defaultState
    this.loadProps = loadProps
    this.getRows = render
    this.onDismiss = onDismiss
    this.beforeLoad = beforeLoad
    this.afterPropsLoad = afterPropsLoad
    this.afterFirstRender = afterFirstRender
    this.onSecondRender = onSecondRender
    this.onConnected$Update = onConnected$Update
    this.isActive = false
    this.has.runPrerenderCallbacks = false
    this.renderCount = 'NONE'
    if (shouldPreloadIcons) this.callbackRegister.start('iconPreloading')
  }

  /** Set init props immediately before render */
  private async initProps() {
    const ownProps = await this.loadProps?.()
    if (!ownProps) return
    this.payload$.updateAttr('ownProps', ownProps, {
      suppressChangeTrigger: true,
    })
    await this.afterPropsLoad?.()
  }

  /** Called only once per table session */
  private async beforeRender() {
    if (this.has.runPrerenderCallbacks) return
    this.has.runPrerenderCallbacks = true
    await this.beforeLoad?.()
    await this.initProps()
    this.callbackRegister.start('payload$')
    if (!(this.syncedPersistedState || this.defaultState)) return
    if (this.syncedPersistedState) {
      this.callbackRegister.start('persistedState$Poller')
    }
    // Initialize persisted state cache
    const initState = (await this.syncedPersistedState?.getData()) ?? this.defaultState!
    this.payload$.updateAttr('state', initState, {
      suppressChangeTrigger: true,
    })
  }

  private incrementRenderCount() {
    switch (this.renderCount) {
      case 'NONE':
        this.renderCount = 'ONCE'
        break
      case 'ONCE':
        this.renderCount = 'MANY'
    }
  }

  private async runOnRenderCount(renderCount: RenderCount, fn?: NoParamFn) {
    if (this.renderCount === renderCount) await fn?.()
  }

  private async cleanup() {
    this.isActive = false
    await this.onDismiss?.()
    this.callbackRegister.cleanupAll()
    this.has.runPrerenderCallbacks = false
    this.renderCount = 'NONE'
  }

  // This function, on paper, does not always return `Promise<State>`. However
  // it does actually always return this when the table is dismissed. This works
  // because after the UITable instance is presented, and being awaited, we can
  // still modify its rows and refresh it, effectively "rerendering" it. This
  // concept is the key to a dynamic UITable.
  async renderTable() {
    try {
      await this.beforeRender()
      await this.beforeEveryRender?.()
      await this.runOnRenderCount('ONCE', this.onSecondRender)
      if (!this.getRows) throw new Error('`beforeRender` must be called first')
      reloadTableRows(this.table, this.getRows().flat().filter(ExcludeFalsy))
      await this.runOnRenderCount('NONE', this.afterFirstRender)
      this.incrementRenderCount()
      if (!this.isActive) {
        this.isActive = true
        this.callbackRegister.start('connected$Poller')
        await this.table.present(this.fullscreen)
        const finalState = this.payload$.getData().state as State
        await this.cleanup()
        return finalState
      }
    } catch (e) {
      await catchTableError(e, this.name)
    }
  }
}
