import { Stream } from '../streams'
import { AnyObj } from '../types/utilTypes'
import { Table } from './TableClass'
import { CombineProps, Connect, ConnectPayload, GetTableOpts, Payload$, SetState, TableAPI, UpdateState } from './types'

/*

TABLE

- Static props (those passed in explicitly) are permanent -- they are never
  recalculated after the initial load and render.

- On the topic of props, a connected stream can be passed in directly. Its data
  will be combined with props. When the stream updates, the table is rerendered,
  and its props will contain the updated stream data.

- As described above, props will never reload. `setState` rerenders the view
  with updated state, but no changes to props occur (unless as a side-effect to
  a connected stream).

- `updateState`, which functions like `setState`, but provides a more
  self-contained method to update with a reducer callback.

- Option to keep table state in sync with a persisted file of the same type.

- `beforeEveryRender` to avoid stuffing callbacks into the render
  function

*/

const getTable = <
  State extends AnyObj | undefined = undefined,
  Props extends AnyObj | undefined = undefined,
  $Data extends AnyObj | undefined = undefined,
>(
  tableOpts: GetTableOpts<State, Props, $Data>,
) => {
  const payload$: Payload$<State, Props> = new Stream({
    name: `table: ${tableOpts.name}`,
    defaultState: {},
  })
  const table = new Table<State, Props, $Data>({ ...tableOpts, payload$ })

  const present: TableAPI<State, Props, $Data>['present'] = (renderOpts) => {
    table.setRenderOpts(renderOpts)
    // When this promise resolves, the table has been dismissed. At that point,
    // `renderTable` will return State, even if its typing and structure are
    // confusing.
    return table.renderTable() as Promise<State>
  }

  const getState = () => {
    const { state } = payload$.getData()
    if (!state) throw new Error('Getting state with no state present')
    return state
  }

  const getProps = () => {
    const { ownProps } = payload$.getData()
    const $ = tableOpts.connected$
    const streamData = $?.$.getData()
    const combinedProps = { ...ownProps, ...streamData } as CombineProps<Props, $Data>
    if (!combinedProps) throw new Error('Getting props with no props present')
    return combinedProps
  }

  const setState: SetState<State> = (partialState) => table.setState(partialState)

  const updateState: UpdateState<State> = (updater) => {
    const updatedState = updater(getState())
    if (updatedState === null || updatedState === undefined) return
    setState(updatedState)
  }

  const rerender = () => table.renderTable()

  const connect: Connect<State, Props, $Data> =
    (getTableEl) =>
    (...ownArgs) =>
      getTableEl(
        {
          state: table.has.state ? getState() : undefined,
          getProps: table.has.props ? getProps : undefined,
          setState,
          updateState,
          rerender,
        } as unknown as ConnectPayload<State, Props, $Data>,
        ...ownArgs,
      )

  return {
    present,
    rerender,
    connect,
    payload$,
    setState,
    updateState,
    getState,
    getProps,
    isTableActive: () => table.isTableActive(),
  } as unknown as TableAPI<State, Props, $Data>
}

export default getTable
