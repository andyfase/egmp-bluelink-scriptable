import { HttpRequestOptions, HttpResponse, IHttpClient } from './IHttpClient'

export class NodeHttpClient implements IHttpClient {
  async request(opts: HttpRequestOptions): Promise<HttpResponse> {
    const response = await fetch(opts.url, {
      method: opts.method,
      headers: opts.headers,
      body: opts.body,
      redirect: opts.noRedirect ? 'manual' : 'follow',
      signal: opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
    })

    const headers: Record<string, string> = {}
    for (const [key, value] of response.headers.entries()) {
      headers[key] = value
    }

    return {
      status: response.status,
      headers,
      body: await response.text(),
      rawResponse: {
        statusCode: response.status,
        headers,
      },
    }
  }
}
