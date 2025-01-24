// Calculations run every time the filter state changes. They need to be very
// performant

import { inANotB, intersection } from '../../array'
import { pick } from '../../object'
import { EntityId } from '../../views/selectableEntityBrowser'
import { $Props, Filter, FilterKeyToFilteredCount, FilterKeyToMatchingIDs, Props, State } from './types'
import { getAppliedFilters, getFilterKey } from './utils'

//
// Calculating the entity IDs that match the filters. Used sparingly.
//

type FilterMatchData = Pick<$Props, 'allEntityIDs' | 'filterKeyToMatchingIDs'>
type CountData = Pick<$Props, 'filterKeyToFilteredCount' | 'numFiltered' | 'numTotal'>

const addFilterMatchData = <E>(
  filterMatchData: FilterMatchData,
  filter: Filter<E>,
  entities: E[],
  { getEntityId: getUniqueEntityId }: Props<E>,
): FilterMatchData => {
  const matchingEntityIDs = new Set<EntityId>()
  for (const entity of entities) {
    const id = getUniqueEntityId(entity)
    filterMatchData.allEntityIDs.add(id)
    if (filter.includeEntity(entity)) matchingEntityIDs.add(id)
  }
  filterMatchData.filterKeyToMatchingIDs.set(getFilterKey(filter), matchingEntityIDs)
  return filterMatchData
}

/** The data returned from this function should only change when the list of
 * entities has changes (i.e. when calling `getEntities` may return a different
 * result). */
const getFilterMatchData = async <E>(props: Props<E>): Promise<FilterMatchData> => {
  const entities = await props.getEntities()
  let result: FilterMatchData = {
    allEntityIDs: new Set(),
    filterKeyToMatchingIDs: new Map(),
  }
  for (const filter of Object.values(props.filters).flat()) {
    result = addFilterMatchData(result, filter, entities, props)
  }
  return result
}

//
// Calculating counts. These are run with most state changes
//

/** Based on the matching entity IDs (i.e. `filterKeyToMatchingIDs`) and filter
 * states, generate a set of all entity IDs that are visible with the current
 * filter settings. */
const buildFilteredEntityIDsFromState = <E>(
  { filterKeyToMatchingIDs, allEntityIDs }: FilterMatchData,
  state: State,
  { filters }: Props<E>,
) => {
  const appliedFilters = getAppliedFilters(state, filters)
  let filteredIDsArr = [...allEntityIDs]
  for (const filter of appliedFilters) {
    const matchingIDsArr = [...filterKeyToMatchingIDs.get(getFilterKey(filter))!]
    switch (filter.state) {
      case null:
        continue
      case 'INCLUDE':
        filteredIDsArr = intersection(filteredIDsArr, matchingIDsArr)
        break
      case 'EXCLUDE':
        filteredIDsArr = inANotB(filteredIDsArr, matchingIDsArr)
    }
  }
  return new Set(filteredIDsArr)
}

/** Calculate how many entities will be present if a given filter is applied */
const getFilterKeyToFilteredCount = <E>(
  filteredEntityIDs: Set<EntityId>,
  { filters }: Props<E>,
  filterKeyToMatchingIDs: FilterKeyToMatchingIDs,
) => {
  const result: FilterKeyToFilteredCount = new Map()
  for (const filter of Object.values(filters).flat()) {
    const key = getFilterKey(filter)
    const matchingIDs = filterKeyToMatchingIDs.get(key)
    if (!matchingIDs) throw new Error(`No matching IDs for key ${key}`)
    result.set(key, [...filteredEntityIDs].filter((id) => matchingIDs.has(id)).length)
  }
  return result
}

const getCounts = <E>(
  { allEntityIDs, filterKeyToMatchingIDs }: FilterMatchData,
  state: State,
  props: Props<E>,
): CountData => {
  const filteredEntityIDs = buildFilteredEntityIDsFromState({ allEntityIDs, filterKeyToMatchingIDs }, state, props)
  return {
    numTotal: allEntityIDs.size,
    numFiltered: filteredEntityIDs.size,
    filterKeyToFilteredCount: getFilterKeyToFilteredCount(filteredEntityIDs, props, filterKeyToMatchingIDs),
  }
}

//

type RecalculateProps$Opts<E> = {
  loadFilterMatchData?: boolean
  prev$Props: $Props
  state: State
  props: Props<E>
}
export const recalculateProps$ = async <E>({
  loadFilterMatchData,
  prev$Props,
  props,
  state,
}: RecalculateProps$Opts<E>): Promise<$Props> => {
  const filterMatchData = loadFilterMatchData
    ? await getFilterMatchData(props)
    : pick(prev$Props, ['filterKeyToMatchingIDs', 'allEntityIDs'])
  const countData = getCounts(filterMatchData, state, props)
  return { ...filterMatchData, ...countData }
}
