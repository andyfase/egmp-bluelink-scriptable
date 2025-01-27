import { isFunc } from '../common'
import PersistedLog from '../io/PersistedLog'
import { lowerIncludes } from '../string'
import { WEBVIEW_PASS_DATA_PREFIX } from './consts'
import { setPassedDataFromUrl } from './utils'

/**
 * A router is essentially an opportunity to hijack requests (usually clicked links)
 * in a WebView. You can side-affect to your heart's content, or simply allow/disallow the request.
 */
type RequestHandler = (request: Request, didPrevSucceed: boolean) => boolean
type ShouldAllowRequest = WebView['shouldAllowRequest']

const makeRouter = (fn: RequestHandler) => fn

//

const presetHandlers = {
  openLinksInSafari: makeRouter((request) => {
    const isAllowedInWebView = ['about:blank', 'calendar.google.com/calendar/event'].some((route) =>
      lowerIncludes(request.url, route),
    )
    if (isAllowedInWebView) return true
    Safari.open(request.url)
    return false
  }),

  /**
   * Should only be used as the last in a series of routers.
   * Logs the request to PersistedLog and mirrors the previous bool value.
   */
  logRequest: makeRouter((request, didPrevSucceed) => {
    PersistedLog().log('{ request, isAllowed: didPrevSucceed }')
    return didPrevSucceed
  }),

  /** If data is being passed in request, set the received data stream */
  receivePassedData: makeRouter((request) => {
    const isPassingData = request.url.startsWith(WEBVIEW_PASS_DATA_PREFIX)
    if (isPassingData) {
      setPassedDataFromUrl(request.url)
      return false
    }
    return true
  }),
}

//

const isCustom = (val: any): val is ShouldAllowRequest => isFunc(val)

type GetRequestRoutersOpts = {
  handlers: (keyof typeof presetHandlers | ShouldAllowRequest)[]
  joinWith?: 'AND' | 'OR'
}

// ts-unused-exports:disable-next-line
export const combineRequestHandlers =
  ({ handlers, joinWith = 'AND' }: GetRequestRoutersOpts): ShouldAllowRequest =>
  (request) => {
    const parsedHandlers = handlers.map<RequestHandler>((keyOrHandler) =>
      isCustom(keyOrHandler) ? keyOrHandler : presetHandlers[keyOrHandler],
    )
    let shouldAllow = joinWith === 'AND'
    for (const handler of parsedHandlers) {
      const didCurrSucceed = handler(request, shouldAllow)
      shouldAllow = joinWith === 'AND' ? shouldAllow && didCurrSucceed : shouldAllow || didCurrSucceed
    }
    return shouldAllow
  }
