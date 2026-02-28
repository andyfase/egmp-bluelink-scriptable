import { HttpCookie, HttpRequestOptions, HttpResponse, IHttpClient } from './IHttpClient'

export class ScriptableHttpClient implements IHttpClient {
  async request(opts: HttpRequestOptions): Promise<HttpResponse> {
    const req = new Request(opts.url)
    req.method = opts.method
    req.headers = opts.headers || {}
    if (opts.body) {
      req.body = opts.body
    }

    if (opts.noRedirect) {
      // @ts-ignore - returning null is allowed
      req.onRedirect = (_request) => null
    }

    if (opts.timeoutMs) {
      req.timeoutInterval = Math.max(opts.timeoutMs / 1000, 1)
    }

    if (opts.allowInsecureRequest) {
      req.allowInsecureRequest = true
    }

    const body = await req.loadString()
    const response = req.response
    const responseCookies = ((response?.cookies as HttpCookie[] | undefined) || []).map((cookie: HttpCookie) => ({
      name: cookie.name,
      value: cookie.value,
    }))

    return {
      status: response?.statusCode || 0,
      headers: (response?.headers as Record<string, string>) || {},
      body,
      cookies: responseCookies,
      rawResponse: response as Record<string, any>,
    }
  }
}
