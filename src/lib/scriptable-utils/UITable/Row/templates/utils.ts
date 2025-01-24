import { RowOpts } from '../types'
import { composeIdentities } from '../../../flow'
import { AnyObj, Identity, IfHasAtLeastOneReq, MapFn } from '../../../types/utilTypes'
import Row from '../Row'

type CombinedRowOpts<OwnOpts extends AnyObj | undefined> = OwnOpts extends undefined ? RowOpts : RowOpts & OwnOpts

type GetRowConstructorReturn = ReturnType<typeof Row> | null

type GetRowContructorReturnedFn<
  OwnOpts extends AnyObj | undefined,
  TypeOpts extends { required: boolean },
> = TypeOpts extends { required: true }
  ? (combinedRowOpts: CombinedRowOpts<OwnOpts>) => GetRowConstructorReturn
  : (combinedRowOpts?: CombinedRowOpts<OwnOpts>) => GetRowConstructorReturn

type CombinedRowConstructor<OwnOpts extends AnyObj | undefined = undefined> = OwnOpts extends AnyObj
  ? IfHasAtLeastOneReq<
      OwnOpts,
      GetRowContructorReturnedFn<OwnOpts, { required: true }>,
      GetRowContructorReturnedFn<OwnOpts, { required: false }>
    >
  : GetRowContructorReturnedFn<OwnOpts, { required: false }>

type GetReducerReturn = Identity<RowOpts> | null

type GetRowConstructor = {
  /** No opts for getReducer */
  (getReducer: (input?: never) => GetReducerReturn): CombinedRowConstructor

  /** Opts required for getReducer */
  <O extends AnyObj | undefined>(getReducer: MapFn<O, GetReducerReturn>): CombinedRowConstructor<O>
}

/** Returns a Row constructor that takes standard RowOpts + OwnOpts provided by
 * constructor */
export const getRowConstructor: GetRowConstructor =
  (getReducer: (ownOpts: any) => GetReducerReturn) =>
  (combinedRowOpts: any = {}) => {
    const reducer = getReducer(combinedRowOpts)
    return reducer && Row(reducer(combinedRowOpts))
  }

export const composeRowConstructor = (...reducers: Identity<RowOpts>[]) =>
  getRowConstructor(() => composeIdentities(...reducers))
