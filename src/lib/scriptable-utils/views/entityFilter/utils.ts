import { SFSymbolKey } from '../../sfSymbols'
import { FlavorOption } from '../../UITable/Row/flavors'
import { AppliedFilterState, Filter, FilterKey, FilterRecord, FilterWithState, State } from './types'

type AnyFilter = Filter<any> | FilterWithState<any>

export const getFilterKey = ({ filterCategory, label }: AnyFilter): FilterKey => `${filterCategory}.${label}`

const lookupFilterByKey = <E>(filterKey: FilterKey, filterRecord: FilterRecord<E>) => {
  const [category, label] = filterKey.split('.')
  if (!(category && label)) throw new Error(`Invalid key ${filterKey}`)
  const filter = filterRecord[category]?.find((f) => f.label === label)
  if (!filter) throw new Error(`No filter found for ${filterKey}`)
  return filter
}

export const getAppliedFilters = <E>({ filterState }: State, allFilters: FilterRecord<E>): FilterWithState<E>[] =>
  [...filterState.entries()]
    .filter(([_, state]) => state)
    .map(([key, state]) => ({
      ...lookupFilterByKey(key, allFilters),
      state,
    }))

export const enhanceFilterWithState = <E>(filter: Filter<E>, state: State): FilterWithState<E> => ({
  ...filter,
  state: state.filterState.get(getFilterKey(filter)) ?? null,
})

export const getAppliedFiltersPredicate =
  <E>(appliedFilters: FilterWithState<E>[]) =>
  (entity: E) => {
    let result: boolean = true
    for (const filter of appliedFilters) {
      const shouldInclude = filter.includeEntity(entity)
      result = (result as boolean) && (filter.state === 'INCLUDE' ? shouldInclude : !shouldInclude)
      if (!result) break
    }
    return result
  }

export const getInitFilterState = <E>(filters: FilterWithState<E>[]): State['filterState'] => {
  const entries = filters.filter((f) => f.state).map<[FilterKey, AppliedFilterState]>((f) => [getFilterKey(f), f.state])
  return new Map(entries)
}

export const areFiltersApplied = ({ filterState }: State) => [...filterState.values()].some(Boolean)

export const getFilterIcon = <E>({ state, icon }: FilterWithState<E>): SFSymbolKey => {
  switch (state) {
    case null:
      return icon ?? 'task_incomplete'
    case 'INCLUDE':
      return 'checkmark'
    case 'EXCLUDE':
      return 'cancel'
  }
}

export const getFilterButtonFlavor = <E>({ state }: FilterWithState<E>): FlavorOption => {
  switch (state) {
    case 'INCLUDE':
      return 'happy'
    case 'EXCLUDE':
      return 'danger'
    case null:
      return 'default'
  }
}
