/**
 * A quick way to create a simple IO to view a list of entities. It supports
 * bulk selection & performing actions on them, and a single-tap action.
 */

import { conditionalArr } from '../array'
import { ExcludeFalsy } from '../common'
import listChoose, { ListChooseOptionObj } from '../input/listChoose'
import textInput from '../input/textInput'
import { getReducerCreator, getTableActionCreator } from '../reducerAction'
import { Stream } from '../streams'
import { MapFn, MaybePromise, NoParamFn, Omit_, Predicate } from '../types/utilTypes'
import { Button, ButtonOpts, Div } from '../UITable'
import { IconOrSFKey } from '../UITable/elements/Icon'
import { Container } from '../UITable/elements/shapes'
import getTable from '../UITable/getTable'
import { H1, PaginationController, Spacer } from '../UITable/Row/templates'
import { H1Opts } from '../UITable/Row/templates/_H1'
import entityFilter from './entityFilter'
import { FilterRecord, FilterWithState } from './entityFilter/types'
import { getAppliedFiltersPredicate } from './entityFilter/utils'

export type BulkAction<E> = {
  icon: IconOrSFKey
  label: string
  onTap: MapFn<E[], any>
  shouldHide?: MapFn<E[], boolean>
}

export type EntityId = string | number

/** Opts passed to consumer from this view when generating an entity row. */
export type EntityRowCallbackOpts<E> = {
  entity: E
  onTap: NoParamFn
  onDoubleTap?: NoParamFn
  isSelected: boolean
}

type State<E> = {
  selectedEntityIds: Set<EntityId>
  appliedFilters: FilterWithState<E>[]
  filterBySearchQuery: string | null
}

type $Props<E> = {
  entityMap: Map<EntityId, E>
  allEntityIds: EntityId[]
  allEntitiesCount: number
}

type CustomCTACallbackOpts<E> = $Props<E> & {
  rerender: NoParamFn
}

type OpenEntityCallbackOpts<E> = CustomCTACallbackOpts<E> & { entity: E }

export type SearchMatchPredicate<T> = (query: string) => Predicate<T>

export type SelectableEntityBrowserOpts<Entity> = {
  /** Optionally run this code before launching the table */
  beforeLoad?: NoParamFn<any>
  onClose?: MapFn<$Props<Entity>, any>
  getEntities: NoParamFn<MaybePromise<Entity[]>>
  getEntityRow: MapFn<EntityRowCallbackOpts<Entity>, Container>
  /** This action occurs when single tapping an entity. */
  openEntity: MapFn<OpenEntityCallbackOpts<Entity>, any>
  /** Available actions when bulk selecting entities. If not provided,
   * multiselect is not permitted. */
  bulkActions?: BulkAction<Entity>[]
  /** Optionally generate a header for the view with visible entities as input */
  headerOpts?: H1Opts
  getCustomCTAs?: MapFn<CustomCTACallbackOpts<Entity>, Omit_<ButtonOpts, 'flavor'>[]>
  /** Used to toggle selection status, etc. */
  getEntityId: MapFn<Entity, EntityId>
  filters?: FilterRecord<Entity>
  /** If present, ability to apply a search filter to the entities. */
  getSearchMatchPredicate?: SearchMatchPredicate<Entity>
}

//

const selectBulkAction = async <E>(entities: E[], bulkActions: SelectableEntityBrowserOpts<E>['bulkActions']) => {
  if (!bulkActions) return
  const chosenAction = await listChoose(
    bulkActions
      .map<ListChooseOptionObj<string, NoParamFn> | null>(({ label, onTap, shouldHide, icon }) =>
        shouldHide?.(entities)
          ? null
          : {
              label,
              icon,
              value: async () => {
                await onTap(entities)
              },
            },
      )
      .filter(ExcludeFalsy),
  )
  await chosenAction?.()
}

const getDefaultProps$State = <E>(): $Props<E> => ({
  entityMap: new Map(),
  allEntityIds: [],
  allEntitiesCount: 0,
})

const generateProps = <E>(entities: E[], getEntityId: SelectableEntityBrowserOpts<E>['getEntityId']) => {
  const result = getDefaultProps$State<E>()
  for (const entity of entities) {
    const id = getEntityId(entity)
    result.entityMap.set(id, entity)
    result.allEntityIds.push(id)
    result.allEntitiesCount++
  }
  return result
}

type GetFilteredEntitiesOpts<E> = Pick<State<E>, 'appliedFilters' | 'filterBySearchQuery'> &
  Pick<SelectableEntityBrowserOpts<E>, 'getEntities' | 'getSearchMatchPredicate'>
const getFilteredEntities = async <E>({
  getEntities,
  appliedFilters,
  getSearchMatchPredicate,
  filterBySearchQuery,
}: GetFilteredEntitiesOpts<E>) => {
  const isShownWithCurrentFilters = getAppliedFiltersPredicate(appliedFilters)
  const entities = await getEntities()
  return entities.filter((entity) => {
    if (!isShownWithCurrentFilters(entity)) return false
    return getSearchMatchPredicate && filterBySearchQuery ? getSearchMatchPredicate(filterBySearchQuery)(entity) : true
  })
}

//

export default async <E>({
  beforeLoad,
  onClose,
  getEntities,
  getEntityRow,
  openEntity,
  bulkActions,
  getEntityId,
  getCustomCTAs,
  headerOpts,
  filters,
  getSearchMatchPredicate,
}: SelectableEntityBrowserOpts<E>) => {
  await beforeLoad?.()

  const ID = `selectable entity browser ${UUID.string()}`

  const props$ = new Stream<$Props<E>>({
    defaultState: getDefaultProps$State(),
    name: ID,
  })
  const reloadEntities = async ({ appliedFilters, filterBySearchQuery }: State<E>) => {
    const filteredEntities = await getFilteredEntities({
      appliedFilters,
      filterBySearchQuery,
      getEntities,
      getSearchMatchPredicate,
    })
    const newProps = generateProps(filteredEntities, getEntityId)
    props$.setData(newProps)
  }

  const { present, connect, getProps, getState, setState, rerender } = getTable<State<E>, undefined, $Props<E>>({
    name: ID,
    connected$: { $: props$ },
  })

  const reducer = getReducerCreator<State<E>>()

  const handleToggleEntitySelect = reducer((state, id: EntityId) => {
    const clone = new Set(state.selectedEntityIds)
    if (clone.has(id)) clone.delete(id)
    else clone.add(id)
    return { ...state, selectedEntityIds: clone }
  })

  const handleDeselectAll = reducer((state) => ({
    ...state,
    selectedEntityIds: new Set(),
  }))

  const handleSetSelectedIds = reducer((state, ids: EntityId[]) => ({
    ...state,
    selectedEntityIds: new Set(ids),
  }))

  const handleSetSearchQuery = reducer((state, query: string) => ({
    ...state,
    filterBySearchQuery: query,
  }))

  const handleClearSearchQuery = reducer((state) => ({
    ...state,
    filterBySearchQuery: null,
  }))

  const action = getTableActionCreator(getState, setState)
  const toggleEntitySelect = action(handleToggleEntitySelect)
  const deselectAll = action(handleDeselectAll)
  const setSelectedIds = action(handleSetSelectedIds)
  const setSearchQuery = action(handleSetSearchQuery)
  const clearSearchQuery = action(handleClearSearchQuery)

  //

  const Header = connect(() => H1(headerOpts || { title: 'Entity browser' }))

  const SearchCTAOpts = (): ButtonOpts | null => {
    if (!getSearchMatchPredicate) return null
    const { filterBySearchQuery: query } = getState()
    return {
      text: query ? `"${query}" (tap to clear)` : 'Search',
      isFaded: !query,
      icon: 'search',
      onTap: async () => {
        if (query) {
          await clearSearchQuery()
        } else {
          const newQuery = await textInput('Enter search query')
          if (!newQuery) return
          await setSearchQuery(newQuery)
        }
        reloadEntities(getState())
      },
    }
  }

  const FilterCTAOpts = (): ButtonOpts | null => {
    if (!filters) return null
    const { appliedFilters } = getState()
    return {
      text: 'Edit filters',
      icon: 'filter',
      ...(appliedFilters.length > 0 && { metadata: appliedFilters.length }),
      onTap: async () => {
        const newFilters = await entityFilter({
          getEntities,
          filters,
          getEntityId: getEntityId,
          initAppliedFilters: appliedFilters,
        })
        setState({ appliedFilters: newFilters })
        reloadEntities(getState())
      },
    }
  }

  const SelectionCTAOpts = (): ButtonOpts | null => {
    const { selectedEntityIds } = getState()
    const { allEntitiesCount, allEntityIds } = getProps()
    if (!(allEntitiesCount && bulkActions)) return null
    const areAllSelected = selectedEntityIds.size === allEntitiesCount
    return {
      text: areAllSelected ? 'Clear selection' : 'Select all',
      icon: areAllSelected ? 'cancel' : 'select_all',
      onTap: () => (areAllSelected ? deselectAll() : setSelectedIds(allEntityIds)),
    }
  }

  const CTAs = connect(({ state }) => {
    const stackOpts = conditionalArr([
      FilterCTAOpts(),
      SearchCTAOpts(),
      SelectionCTAOpts(),
      ...(getCustomCTAs
        ? getCustomCTAs({
            ...getProps(),
            rerender: () => reloadEntities(state),
          })
        : []),
    ]).map<ButtonOpts>((opt) => ({ ...opt }))
    return stackOpts.length > 0 && Div(stackOpts.map(Button))
  })

  const EntityRow = (id: EntityId) => {
    const state = getState()
    const { selectedEntityIds } = state
    const props = getProps()
    const { entityMap } = props
    const numSelected = selectedEntityIds.size
    const isSelected = selectedEntityIds.has(id)
    const entity = entityMap.get(id)!
    const openEntityOpts: OpenEntityCallbackOpts<E> = {
      ...props,
      rerender,
      entity,
    }
    return getEntityRow({
      entity,
      isSelected,
      onTap: async () => {
        if (numSelected) return toggleEntitySelect(id)
        await openEntity(openEntityOpts)
        reloadEntities(state)
      },
      onDoubleTap: async () => {
        if (!numSelected) return setSelectedIds([id])
        const isSelectingBulkAction = isSelected && numSelected > 1
        if (isSelectingBulkAction) {
          const selectedEntities = [...selectedEntityIds].map((id) => entityMap.get(id)!)
          await selectBulkAction(selectedEntities, bulkActions)
        } else await openEntity(openEntityOpts)
        deselectAll()
        reloadEntities(state)
      },
    })
  }

  const Pagination = connect(({ rerender }) =>
    PaginationController({
      getEntities: () => getProps().allEntityIds,
      getEntityRow: EntityRow,
      rerenderParent: rerender,
      name: ID,
    }),
  )

  //

  const defaultState: State<E> = {
    selectedEntityIds: new Set(),
    appliedFilters: [],
    filterBySearchQuery: null,
  }

  await present({
    defaultState,
    beforeLoad: () => reloadEntities(defaultState),
    onDismiss: async () => {
      await onClose?.(props$.getData())
    },
    render: () => [Header(), CTAs(), Spacer(), Pagination()],
  })
}
