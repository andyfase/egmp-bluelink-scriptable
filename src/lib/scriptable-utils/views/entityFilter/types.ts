import { SFSymbolKey } from '../../sfSymbols'
import { Predicate } from '../../types/utilTypes'
import { SetRenderOpts } from '../../UITable/types'
import { EntityId, SelectableEntityBrowserOpts } from '../../views/selectableEntityBrowser'

export type AppliedFilterState = 'INCLUDE' | 'EXCLUDE' | null

export type Filter<E> = {
  label: string
  icon?: SFSymbolKey
  filterCategory: string
  // Should the entity be included if its state is `INCLUDE`?
  includeEntity: Predicate<E>
}

export type FilterWithState<E> = Filter<E> & { state: AppliedFilterState }

export type FilterRecord<E> = {
  [category: string]: Filter<E>[]
}

/** Used to uniquely a filter in a FilterRecord. Key is of the format
 * `${category}.${filterLabel}` */
export type FilterKey = `${string}.${string}`

export type FilterKeyToMatchingIDs = Map<FilterKey, Set<EntityId>>

/** The number represents how many entities will match the filters if the filter
 * with this `FilterKey` is applied. Used directly in UI.  */
export type FilterKeyToFilteredCount = Map<FilterKey, number>

export type $Props = {
  allEntityIDs: Set<EntityId>
  filterKeyToMatchingIDs: FilterKeyToMatchingIDs
  filterKeyToFilteredCount: FilterKeyToFilteredCount
  numFiltered: number
  numTotal: number
}

export type Opts<E> = {
  title?: string
  filters: FilterRecord<E>
  initAppliedFilters?: FilterWithState<E>[]
} & Pick<SetRenderOpts<any, any, any>, 'beforeLoad' | 'onDismiss'> &
  Pick<SelectableEntityBrowserOpts<E>, 'getEntityId' | 'getEntities'>

export type State = {
  filterState: Map<FilterKey, AppliedFilterState>
  collapsedFilterCategories: string[]
}

export type Props<E> = Opts<E>
