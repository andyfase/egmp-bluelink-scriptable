export interface HttpCookie {
  name: string
  value: string
}

export interface HttpRequestOptions {
  url: string
  method: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
  allowInsecureRequest?: boolean
  noRedirect?: boolean
}

export interface HttpResponse {
  status: number
  headers: Record<string, string>
  body: string
  cookies?: HttpCookie[]
  rawResponse?: Record<string, any>
}

export interface IHttpClient {
  request(opts: HttpRequestOptions): Promise<HttpResponse>
}
