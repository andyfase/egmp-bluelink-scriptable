import { conditionalArr } from '../../array'
import { ExcludeFalsy } from '../../common'
import { isEqual } from '../../object'
import { getTableActionCreator } from '../../reducerAction'
import { Stream, subscribe } from '../../streams'
import { Button, ButtonOpts, Div } from '../../UITable'
import getTable from '../../UITable/getTable'
import { H1, H2, Spacer } from '../../UITable/Row/templates'
import { recalculateProps$ } from './props$Calculations'
import { handleClearFilters, handleCycleFilterState, handleToggleFilterCategoryCollapse } from './reducers'
import { $Props, FilterWithState, Opts, Props, State } from './types'
import {
  areFiltersApplied,
  enhanceFilterWithState,
  getAppliedFilters,
  getFilterButtonFlavor,
  getFilterIcon,
  getFilterKey,
  getInitFilterState,
} from './utils'

export default async <E>(opts: Opts<E>) => {
  const { initAppliedFilters, beforeLoad, onDismiss, filters } = opts

  const instanceID = `entityFilter ${UUID.string()}`
  const props$ = new Stream<$Props>({
    name: instanceID,
    defaultState: {
      allEntityIDs: new Set(),
      filterKeyToMatchingIDs: new Map(),
      filterKeyToFilteredCount: new Map(),
      numFiltered: 0,
      numTotal: 0,
    },
  })

  const { present, connect, getState, setState, getProps, payload$ } = getTable<State, Props<E>, $Props>({
    name: instanceID,
    connected$: { $: props$ },
  })

  const hardReloadProps$ = async (state: State) =>
    props$.setData(
      await recalculateProps$({
        loadFilterMatchData: true,
        prev$Props: props$.getData(),
        props: opts,
        state,
      }),
    )

  const updateProps$onStateChange = subscribe({
    subscriptionName: 'update props$ on some state change',
    dependent$: props$,
    source$: payload$,
    stateReducer: (prev$Props, { state: oldState }, { state: newState }) => {
      if (!(oldState && newState)) return null
      const haveFiltersChanged = !isEqual([...oldState.filterState.entries()], [...newState.filterState.entries()])
      return haveFiltersChanged ? recalculateProps$({ prev$Props, props: opts, state: newState }) : null
    },
  })

  const action = getTableActionCreator(getState, setState)
  const cycleFilterState = action(handleCycleFilterState)
  const clearFilters = action(handleClearFilters)
  const toggleFilterCategoryCollapse = action(handleToggleFilterCategoryCollapse)

  //

  const Title = connect(() => {
    const { title, numFiltered, numTotal } = getProps()
    return H1({
      title: title ?? 'Filter entities',
      subtitle: `${numFiltered}/${numTotal}`,
    })
  })

  const CTAs = connect(({ state }) =>
    Div([
      Button({
        text: 'Clear filters',
        icon: 'filter',
        onTap: clearFilters,
        isDisabled: !areFiltersApplied(state),
        flavor: 'transparentWithBorder',
      }),
    ]),
  )

  const getFilterRowOpts = (filter: FilterWithState<E>): ButtonOpts | null => {
    const { filterKeyToFilteredCount, numFiltered } = getProps()
    const isApplied = filter.state !== null
    const count = filterKeyToFilteredCount.get(getFilterKey(filter))
    const wouldNotChangeResults = count === numFiltered
    const isNotApplyable = (!count || wouldNotChangeResults) && !isApplied
    if (isNotApplyable) return null
    return {
      text: filter.label,
      icon: getFilterIcon(filter),
      flavor: getFilterButtonFlavor(filter),
      ...(count && !isApplied && { metadata: count }),
      onTap: () => cycleFilterState(filter),
    }
  }

  const FilterCategoryHeader = connect((_, category: string, isCollapsed: boolean) =>
    H2({
      label: category,
      iconKey: isCollapsed ? 'expand' : 'collapse',
      padding: { paddingBottom: 0, paddingTop: 0 },
      onTap: () => toggleFilterCategoryCollapse(category),
    }),
  )

  const FilterCategory = connect(({ state }, category: string) => {
    const isCollapsed = state.collapsedFilterCategories.includes(category)
    const catFilters = getProps().filters[category]!
    const filterButtonOpts = catFilters
      .map((filter) => enhanceFilterWithState(filter, state))
      .map(getFilterRowOpts)
      .filter(ExcludeFalsy)
    if (filterButtonOpts.length === 0) return null
    return conditionalArr([
      FilterCategoryHeader(category, isCollapsed),
      !isCollapsed && Div(filterButtonOpts.map(Button)),
      Spacer(),
      Spacer(),
    ]).flat()
  })

  const FilterCategories = connect(() => Object.keys(getProps().filters).flatMap(FilterCategory))

  //

  const defaultState: State = {
    filterState: getInitFilterState(initAppliedFilters ?? []),
    collapsedFilterCategories: [],
  }

  const finalState = await present({
    beforeLoad: () => {
      hardReloadProps$(defaultState)
      return beforeLoad?.()
    },
    onDismiss: () => {
      updateProps$onStateChange.unsubscribe()
      return onDismiss?.()
    },
    defaultState,
    loadProps: () => opts,
    render: () => [Title(), CTAs(), Spacer(), Spacer(), Spacer(), FilterCategories()],
  })

  return getAppliedFilters(finalState, filters)
}

export * from './types'
