import { WebViewOpts } from './types'
import { getWebView, loadWebViewHTML } from './utils'

export const webView = (opts: WebViewOpts = {}) => {
  const w = getWebView(opts)
  return {
    render: ({ fullscreen = false } = {}) => w.present(fullscreen),
    renderThenEvaluateJs: async <R = unknown>(javascript: string, { fullscreen = false } = {}) => {
      await w.present(fullscreen)
      return (await w.evaluateJavaScript(javascript)) as R
    },
    evaluateJs: async <R = unknown>(javascript: string, useCallback = true) =>
      (await w.evaluateJavaScript(javascript, useCallback)) as R,
    loadHTML: (html: string) => loadWebViewHTML(w, html, opts.routeLinkClicksThroughWindowLocation),
    setRequestHandler: (handler: WebView['shouldAllowRequest']) => (w.shouldAllowRequest = handler),
  }
}

export * from './utils'
