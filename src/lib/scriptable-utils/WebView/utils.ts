import { safeArrLookup } from '../common'
import { Stream } from '../streams'
import { lowerIncludes, spliceInPlace, splitByRegex } from '../string'
import { AnyObj } from '../types/utilTypes'
import { getUrlEncodedParams } from '../url'
import { WEBVIEW_PASS_DATA_PREFIX } from './consts'
import { WebViewOpts } from './types'

export const loadWebViewHTML = async (w: WebView, html: string, routeLinkClicksThroughWindowLocation = true) => {
  const parsedHtml = routeLinkClicksThroughWindowLocation
    ? injectScriptInHtmlStr(html, routeAllLinksThroughWindowLocation)
    : html
  await w.loadHTML(parsedHtml)
}

export const getWebView = ({
  shouldAllowRequest,
  html,
  url,
  routeLinkClicksThroughWindowLocation = true,
}: WebViewOpts) => {
  const w = new WebView()
  if (shouldAllowRequest) w.shouldAllowRequest = shouldAllowRequest
  if (html) loadWebViewHTML(w, html, routeLinkClicksThroughWindowLocation)
  else if (url) w.loadURL(url)
  return w
}

/** This ensures that all link clicks pass through `shouldAllowRequest` */
const routeAllLinksThroughWindowLocation = [
  `window.addEventListener(`,
  ` 'click',`,
  ` event => {`,
  `   const closestLink = event.target && event.target.closest('a');`,
  `   if (!closestLink) return;`,
  `   event.preventDefault();`,
  `   const url = closestLink.getAttribute('href');`,
  `   window.location.href = url;`,
  ` },`,
  ` true`,
  `);`,
]
  .map((line) => line.trim())
  .join('')

const wrapInHtmlTags = (htmlStr: string) => {
  const hasHTMLTags = lowerIncludes(htmlStr, '<html') && lowerIncludes(htmlStr, '</html>')
  return hasHTMLTags ? htmlStr : `<html>${htmlStr}</html>`
}

const injectScriptInHtmlStr = (htmlStr: string, script: string) => {
  const hasHead = lowerIncludes(htmlStr, '<head') && lowerIncludes(htmlStr, '</head>')
  const hasHtml = lowerIncludes(htmlStr, '<html') && lowerIncludes(htmlStr, '</html>')
  const scriptInTag = `<script>${script}</script>`
  const scriptTagInHead = `<head>${scriptInTag}</head>`
  if (hasHead) {
    return wrapInHtmlTags(spliceInPlace(htmlStr.split('</head>'), 1, 0, `${scriptInTag}</head>`).join(''))
  }
  return hasHtml
    ? ['<html>', `${scriptTagInHead}`, splitByRegex(htmlStr, /<html[^<>]*>/i)[1]].join('')
    : wrapInHtmlTags([scriptTagInHead, htmlStr].join(''))
}

//

// ts-unused-exports:disable-next-line
export const getPassDataUrl = (args: AnyObj, baseUrl = '') =>
  `${WEBVIEW_PASS_DATA_PREFIX}${baseUrl}?${getUrlEncodedParams(args)}`

/** When data is passed from a WebView, it is stored here. */
const passedData$ = new Stream<any>({
  name: 'webview passedData$',
  defaultState: {},
  showStreamDataUpdateDebug: false,
})

const setPassedData = (data: AnyObj) => passedData$.setData(data)

const parsePassedData = (requestUrl: string) => {
  const dataParamStr = safeArrLookup(requestUrl.split(WEBVIEW_PASS_DATA_PREFIX), 1, 'parsePassedData.1')
  const keyValPairStrs = dataParamStr.split(/\?|&/g).filter(Boolean)
  const response: AnyObj = {}
  for (const keyValPairStr of keyValPairStrs) {
    const splitArr = keyValPairStr.split('=')
    const key = safeArrLookup(splitArr, 0, 'parsePassedData.2')
    const encodedVal = safeArrLookup(splitArr, 1, 'parsePassedData.3')
    response[key] = decodeURIComponent(encodedVal)
  }
  return response
}

export const setPassedDataFromUrl = (requestUrl: string) => setPassedData(parsePassedData(requestUrl))

// ts-unused-exports:disable-next-line
export const subscribeToWebviewPassedData = <ExpectedDataType extends AnyObj>(
  onUpdate: (data: ExpectedDataType) => any,
) =>
  passedData$.registerUpdateCallback({
    // We can force this type since all data will always be passed
    callback: onUpdate as (data: Partial<ExpectedDataType>) => any,
    callbackId: 'subscribeToWebviewPassedData',
    overwriteExistingCallback: true,
  })

//

const urlFetchJS = {
  url: 'window.location.href',
  title: 'document.title',
  elCount: 'document.getElementsByTagName("*").length',
}

export type UrlDetails = { url: string; title: string; elCount: number }

export const getUrlDetails = async (url: string): Promise<UrlDetails> => {
  const w = new WebView()
  await w.loadURL(url)
  try {
    return (await w.evaluateJavaScript(
      `({ url: ${urlFetchJS.url}, title: ${urlFetchJS.title}, elCount: ${urlFetchJS.elCount} })`,
    )) as UrlDetails
  } catch {
    return { title: 'Could not load page', url, elCount: 0 }
  }
}
