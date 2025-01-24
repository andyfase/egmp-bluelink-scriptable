import { mapFind } from '../array'
import { ErrorWithPayload, isObject, isString } from '../common'
import { getUrlEncodedParams } from '../url'
import { DEFAULT_DEBUG_OPTS, fetchDebug } from './debug'
import { FetchOpts, ParsedFetchOpts } from './types'
import { maybeCensorHeaders } from './utils'

const getBody = <R>({ body, contentType }: ParsedFetchOpts<R>) => {
  if (!body) return null
  if (isString(body)) return body
  const isBodyUrlEncoded = contentType === 'application/x-www-form-urlencoded'
  return isBodyUrlEncoded ? getUrlEncodedParams(body) : JSON.stringify(body)
}

const getRequestAttributes = <R>(opts: ParsedFetchOpts<R>) => ({
  body: getBody(opts),
  headers: {
    'Content-Type': opts.contentType,
    ...opts.headers,
  },
})

/** Gets an object which describes the ongoing request for debug logging. */
const getRequestLogMessage = <R>(opts: ParsedFetchOpts<R>) => {
  const { body, headers } = getRequestAttributes(opts)
  return {
    ...opts,
    ...(opts.debug.includeVerbose && { body }),
    headers: maybeCensorHeaders(headers, opts),
  }
}

const getRequest = <R>(opts: ParsedFetchOpts<R>) => {
  const { url, method } = opts
  const { body, headers } = getRequestAttributes(opts)
  const req = new Request(url)
  req.method = method
  req.headers = headers
  if (body) req.body = body
  return req
}

const parseFetchOpts = <R>({ debug = DEFAULT_DEBUG_OPTS, ...restOpts }: FetchOpts<R>): ParsedFetchOpts<R> => ({
  debug,
  ...restOpts,
})

const isStatusCodeError = (code: unknown) => {
  const str = String(code)
  return !(str.startsWith('1') || str.startsWith('2'))
}

const possibleErrorKeys = ['message', 'errorMessages', 'error']
/** This is a weak attempt to get error messages from a variety of error
 * response shapes across multiple APIs. */
const getResponseError = (response: unknown): string | null => {
  // In case the response is a stringified object/arr
  try {
    if (!isString(response)) {
      throw new Error('Response not a string')
    }
    const parsed = JSON.parse(response) as unknown
    return getResponseError(parsed)
  } catch {
    if (Array.isArray(response)) {
      return response.find(getResponseError) as string | null
    }
    if (isObject(response)) {
      const keyError = mapFind(Object.entries(response), ([key, val]) =>
        possibleErrorKeys.includes(key) ? getResponseError(val) : null,
      )
      if (keyError) return keyError
    }
    if (isString(response)) return response
    return null
  }
}

export default async <Returns = unknown>(opts: FetchOpts<Returns>) => {
  const parsedOpts = parseFetchOpts(opts)
  const log = (message: unknown, isVerbose = false) => fetchDebug({ message, parsedOpts, isVerbose })
  const { url, fetchFnKey, responseValidator } = parsedOpts

  await log(`Initiating request to "${url}"...`)
  log(getRequestLogMessage(parsedOpts))
  const requestObj = getRequest(parsedOpts)

  const response = (await requestObj[fetchFnKey]()) as unknown
  await log({ response }, true)

  const { statusCode } = requestObj.response
  const isErrorCode = isStatusCodeError(statusCode)
  if (isErrorCode) {
    const error = new ErrorWithPayload(`${statusCode}: ${getResponseError(response) || 'Unknown error'}`, {
      completedRequestDetails: requestObj.response,
      response,
    })
    log({ error })
    throw error
  }

  // Check that response type is as expected
  if (responseValidator) {
    try {
      const { isValid, errorMessage } = responseValidator(response as Returns)
      if (!isValid) throw new Error(errorMessage ?? 'validation failed')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'can not parse error'
      throw new Error(`Validation error in ${fetchFnKey}(${url}): "${errorMessage}"`)
    }
  }

  return response as Returns
}
