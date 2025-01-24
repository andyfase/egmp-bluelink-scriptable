import fetchBase from '../fetchBase'
import { FetchImplementationOpts, FetchOpts } from '../types'

const getArgs = <R>(
  contentType: FetchOpts<R>['contentType'],
  fetchFnKey: FetchOpts<R>['fetchFnKey'],
  opts: FetchImplementationOpts<R>,
): FetchOpts<R> => ({
  method: 'POST',
  contentType,
  fetchFnKey,
  ...opts,
})

export const postJson = <R = void>(opts: FetchImplementationOpts<R>) =>
  fetchBase<R>(getArgs('application/json', 'loadJSON', opts))

export const postString = (opts: FetchImplementationOpts<string>) =>
  fetchBase<string>(getArgs('application/json', 'loadString', opts))
