import { isBoolean, isNumber, isString } from './common'
import { AnyObj, ObjKey } from './types/utilTypes'

const getValAsString = (val: any) => (isString(val) ? val : JSON.stringify(val))

/** Returns key=val w/ proper encoding */
const getUrlEncodedParam = (key: ObjKey, val: unknown) => {
  if (val === undefined) return null
  if (!isString(val) && !isNumber(val) && !isBoolean(val)) {
    throw new Error('Object value type not supported by getUrlEncodedParam')
  }
  return [key, encodeURIComponent(getValAsString(val))].join('=')
}

/** Returns encoded params w/o ? at beginning, e.g. a=1&b=2&c=3 */
export const getUrlEncodedParams = (params: AnyObj): string => {
  let encodedParams = ''
  for (const [key, value] of Object.entries(params)) {
    const paramStr = getUrlEncodedParam(key, value)
    if (!paramStr) continue
    const joiner = encodedParams.length > 0 ? '&' : ''
    encodedParams = [encodedParams, paramStr].join(joiner)
  }
  return encodedParams
}

const appendParamReducer = (currUrl: string, [key, val]: [key: ObjKey, val: unknown]) => {
  const joiner = currUrl.includes('?') ? '&' : '?'
  const encodedParam = getUrlEncodedParam(key, val)
  return encodedParam ? [currUrl, encodedParam].join(joiner) : currUrl
}

export const url = (url: string, params: AnyObj = {}): string => {
  let constructedUrl = url
  for (const entry of Object.entries(params)) {
    constructedUrl = appendParamReducer(constructedUrl, entry)
  }
  return constructedUrl
}

export const openUrl = (url: string) => Safari.open(url)

export const openCallbackUrl = async <ExpectedReturn = void>(baseUrl: string, params: AnyObj = {}) => {
  const cb = new CallbackURL(baseUrl)
  for (const [key, val] of Object.entries(params)) {
    // Params need to be explicitly added like this on CallbackURL objects.
    if (val !== undefined) cb.addParameter(key, getValAsString(val))
  }
  try {
    const result = await cb.open()
    return result as unknown as ExpectedReturn
  } catch (e) {
    const prompt = new Alert()
    prompt.title = `Error encountered opening callback URL`
    prompt.message = String(e)
    prompt.addAction('OK')
    await prompt.present()
    throw new Error(e as string | undefined)
  }
}

const FORUMS = [
  'reddit.com',
  'stackoverflow.com',
  'stackexchange.com',
  'news.ycombinator.com',
  'macstories.net',
  'tripadvisor.com',
  'community.effectiveremotework.com',
  'forum.gettingthingsdone.com',
  'talk.automators.fm',
]

export const getGoogleSearchUrl = (query: string) => url('https://www.google.com/search', { q: query })

export const getForumSearchUrl = (query: string) => {
  let siteSearchText = ''
  for (const forum of FORUMS) {
    const joiner = encodeURIComponent(siteSearchText.length > 0 ? ' OR site:' : ' site:')
    siteSearchText = [siteSearchText, joiner, forum].join('')
  }
  return `${getGoogleSearchUrl(query)}${siteSearchText}`
}

export const isGmailLink = (link: string) => link.toLowerCase().includes('mail.google.com')
