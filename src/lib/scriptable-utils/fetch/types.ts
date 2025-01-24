import { AnyObj, FunctionKeys, MakeSomeReqd } from '../types/utilTypes'
import { CONTENT_TYPES } from './consts'

export type ContentTypes = (typeof CONTENT_TYPES)[number]

export type DebugOpts = {
  enabled?: boolean
  logToPersistedLog?: boolean
  includeVerbose?: boolean
}

export type FetchOpts<R> = Pick<Request, 'url' | 'headers' | 'method'> & {
  contentType: string
  fetchFnKey: FunctionKeys<Request>
  body?: string | AnyObj
  debug?: DebugOpts
  responseValidator?: (response: R) => {
    isValid: boolean
    errorMessage?: string
  }
}

export type ParsedFetchOpts<R> = MakeSomeReqd<FetchOpts<R>, 'debug'>

/**
 * When implemented, the fetch fn and method are known, and content type
 * has a default value
 */
export type FetchImplementationOpts<R> = Omit<FetchOpts<R>, 'fetchFnKey' | 'method' | 'contentType'> &
  Partial<Pick<FetchOpts<R>, 'contentType'>>
