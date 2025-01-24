export type WebViewOpts = Pick<Partial<WebView>, 'shouldAllowRequest'> & {
  html?: string
  url?: string
  /** This overrides link (<a>) behavior to always be directed through
   * `window.location.href = ...`. This forces them to be caught by
   * `shouldAllowRequest`. */
  routeLinkClicksThroughWindowLocation?: boolean
}
