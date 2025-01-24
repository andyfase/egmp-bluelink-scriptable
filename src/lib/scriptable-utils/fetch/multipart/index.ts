import { AnyObj } from '../../types/utilTypes'
import { postString } from '../verbs/post'
import { MultipartOpts } from './types'
import { extractMultipartResponseArray, getMultipartBody } from './utils'

type MultipartRequestFn = {
  <R extends AnyObj = Record<string, unknown>>(opts: MultipartOpts & { parseResponse?: true }): Promise<R[]>
  (opts: MultipartOpts & { parseResponse: false }): Promise<null>
}

const multipartRequest: MultipartRequestFn = async ({
  requests,
  boundary = 'batch_boundary',
  parseResponse = true,
  ...restPostOpts
}: MultipartOpts): Promise<any> => {
  const body = getMultipartBody({ requests, boundary })
  const response = await postString({
    ...restPostOpts,
    contentType: `multipart/mixed; boundary=${boundary}`,
    body,
  })
  if (!parseResponse) return null
  if (!response) throw new Error('No response for multipart request')
  return extractMultipartResponseArray(response)
}

export default multipartRequest

export * from './types'
