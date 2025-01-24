import fetchBase from '../fetchBase'
import { FetchImplementationOpts, FetchOpts } from '../types'

const getArgs = <R>(
  contentType: FetchOpts<R>['contentType'],
  fetchFnKey: FetchOpts<R>['fetchFnKey'],
  opts: FetchImplementationOpts<R>,
): FetchOpts<R> => ({ method: 'PUT', contentType, fetchFnKey, ...opts })

export const putJson = <R = void>(opts: FetchImplementationOpts<R>) =>
  fetchBase<R>(getArgs('application/json', 'loadJSON', opts))

// export const putString = (opts: FetchImplementationOpts) =>
//   fetchBase<string>(getArgs('application/json', 'loadString', opts));
