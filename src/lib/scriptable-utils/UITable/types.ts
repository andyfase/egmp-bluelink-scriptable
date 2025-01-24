import { Persisted } from '../io/persisted'
import { RepeatingTimerOpts } from '../RepeatingTimer'
import { Stream } from '../streams'
import { AnyObj, Falsy, MapFn, MaybeArray, MaybePromise, NoParamFn } from '../types/utilTypes'
import { Container } from './elements/shapes'

/** Falsy values will be filtered out, arrays will be flattened.  */
export type ValidTableEl = MaybeArray<UITableRow | Container | Falsy>

export type CombineProps<Props, $Data> = Props extends undefined
  ? $Data extends undefined
    ? undefined
    : $Data
  : $Data extends undefined
    ? Props
    : Props & $Data

//
//
//
// TABLE OPTS
//
//
//

export type Connected$Opts<$Data extends AnyObj | undefined> = $Data extends AnyObj
  ? { $: Stream<$Data> } & Pick<RepeatingTimerOpts, 'interval' | 'timeout'>
  : undefined

export type LoadProps<Props> = NoParamFn<MaybePromise<Props>>

export type Payload$<State, Props> = Stream<Partial<{ state: State; ownProps: Props; connected$ChangeCount: number }>>

export type TableOpts<State, Props, $Data extends AnyObj | undefined> = {
  name: string
  showSeparators?: boolean
  fullscreen?: boolean
  beforeEveryRender?: BeforeEveryRender
  payload$: Payload$<State, Props>
  syncedPersistedState?: Persisted<State>
  connected$?: $Data extends AnyObj ? Connected$Opts<$Data> : never
}

/** Everything in TableOpts except `payload$`, which is created within `getTable` */
export type GetTableOpts<State, Props, $Data extends AnyObj | undefined> = Pick<
  TableOpts<State, Props, $Data>,
  // Always present
  'name' | 'showSeparators' | 'fullscreen' | 'beforeEveryRender'
> & {
  syncedPersistedState?: Required<TableOpts<State, Props, $Data>>['syncedPersistedState']
  connected$?: Required<TableOpts<State, Props, $Data>>['connected$']
}

//
//
//
// TABLE RETURN/API
//
//
//

export type SetState<State> = MapFn<Partial<State>, void>

/** If null/void is returned, do not update state. */
export type UpdateState<State> = (updater: MapFn<State, State | null | undefined>) => void

type GetProps<Props, $Data> = NoParamFn<CombineProps<Props, $Data>>

type Rerender = NoParamFn

type GetState<State> = NoParamFn<State>

type IsTableActive = NoParamFn<boolean>

export type OnDismiss = NoParamFn

export type OnConnected$Update<$Data> = MapFn<$Data, any>

export type BeforeLoad = NoParamFn

export type BeforeEveryRender = NoParamFn

export type AfterPropsLoad = NoParamFn

export type AfterFirstRender = NoParamFn

export type OnSecondRender = NoParamFn

export type RenderCount = 'NONE' | 'ONCE' | 'MANY'

export type GetRows = NoParamFn<ValidTableEl[]>

//

export type ConnectPayload<State, Props, $Data> = {
  state: State
  getProps: GetProps<Props, $Data>
  setState: SetState<State>
  updateState: UpdateState<State>
  rerender: Rerender
}

export type Connect<State, Props, $Data> = <A extends any[]>(
  getTableEl: (connectPayload: ConnectPayload<State, Props, $Data>, ...ownArgs: A) => ValidTableEl,
) => (...ownArgs: A) => ValidTableEl

export type SetRenderOpts<State, Props, $Data> = {
  render: GetRows
  defaultState?: State
  loadProps?: LoadProps<Props>
  onDismiss?: OnDismiss
  beforeLoad?: BeforeLoad
  afterPropsLoad?: AfterPropsLoad
  afterFirstRender?: AfterFirstRender
  onSecondRender?: OnSecondRender
  onConnected$Update?: OnConnected$Update<$Data>
  /** If true, the table will automatically refresh as its preload-icon list
   * gets loaded. */
  shouldPreloadIcons?: boolean
}

export type TableAPI<State, Props, $Data> = {
  present: MapFn<SetRenderOpts<State, Props, $Data>, Promise<State>>
  rerender: Rerender
  connect: Connect<State, Props, $Data>
  payload$: Payload$<State, Props>
  setState: SetState<State>
  updateState: UpdateState<State>
  getState: GetState<State>
  getProps: GetProps<Props, $Data>
  isTableActive: IsTableActive
}
