import { toggleArrayItem } from '../../array'
import { cycle } from '../../flow'
import { getReducerCreator } from '../../reducerAction'
import { AppliedFilterState, FilterWithState, State } from './types'
import { getFilterKey } from './utils'

const reducer = getReducerCreator<State>()

export const handleCycleFilterState = reducer((state, targetFilter: FilterWithState<any>) => {
  const newFilterState = cycle<AppliedFilterState>(targetFilter.state, ['INCLUDE', 'EXCLUDE', null])
  const updatedFilterState = new Map(state.filterState.entries())
  updatedFilterState.set(getFilterKey(targetFilter), newFilterState)
  return { ...state, filterState: updatedFilterState }
})

export const handleClearFilters = reducer((state) => ({
  ...state,
  filterState: new Map(),
}))

export const handleToggleFilterCategoryCollapse = reducer((state, category: string) => ({
  ...state,
  collapsedFilterCategories: toggleArrayItem(state.collapsedFilterCategories, category),
}))
