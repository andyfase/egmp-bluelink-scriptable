import fetchBase from '../fetchBase'
import { FetchImplementationOpts, FetchOpts } from '../types'

const getArgs = <R>(
  contentType: FetchOpts<R>['contentType'],
  fetchFnKey: FetchOpts<R>['fetchFnKey'],
  opts: FetchImplementationOpts<R>,
): FetchOpts<R> => ({
  method: 'GET',
  contentType,
  fetchFnKey,
  ...opts,
})

export const getJson = <R>(opts: FetchImplementationOpts<R>) =>
  fetchBase<R>(getArgs('application/json', 'loadJSON', opts))

// export const getString = <R>(opts: FetchImplementationOpts) =>
//   fetchBase<R>(getArgs('text/xml', 'loadString', opts));

// export const getImage = (opts: FetchImplementationOpts) =>
//   fetchBase<Image>(getArgs('application/octet-stream', 'loadImage', opts));

// export const getData = (opts: FetchImplementationOpts) =>
//   fetchBase<Data>(getArgs('application/octet-stream', 'load', opts));
