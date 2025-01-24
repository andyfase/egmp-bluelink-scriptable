import PersistedLog from '../io/PersistedLog'
import { tidyLog } from '../string'
import { DebugOpts, ParsedFetchOpts } from './types'

export const DEFAULT_DEBUG_OPTS: DebugOpts = {
  enabled: false,
  logToPersistedLog: false,
  includeVerbose: false,
}

type FetchDebugOpts<R> = {
  message: any
  /** Is the message being logged verbose? */
  isVerbose?: boolean
  parsedOpts: ParsedFetchOpts<R>
}
export const fetchDebug = <R>({
  message,
  isVerbose = false,
  parsedOpts: {
    debug: { enabled, logToPersistedLog, includeVerbose },
  },
}: FetchDebugOpts<R>) => {
  if (!enabled) return
  if (isVerbose && !includeVerbose) return
  return logToPersistedLog ? PersistedLog.log(message) : tidyLog(message)
}
