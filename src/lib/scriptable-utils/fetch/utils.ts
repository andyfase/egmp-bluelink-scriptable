import { AnyObj } from '../types/utilTypes'
import { ParsedFetchOpts } from './types'

// Don't log auth details in persisted log
export const maybeCensorHeaders = <R>(headers: AnyObj, { debug: { logToPersistedLog } }: ParsedFetchOpts<R>) => {
  if (!logToPersistedLog || !headers.Authorization) return headers
  return { ...headers, Authorization: 'Censored for security' }
}
