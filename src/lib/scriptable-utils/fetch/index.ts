import * as get from './verbs/get'
import * as post from './verbs/post'
export const postJson = post.postJson

export const getJson = get.getJson

export { getPaginatedResults, GetPaginatedResultsOpts } from './getPaginatedResults'
export { default as multipartRequest, MultipartOpts, MultipartRequest } from './multipart'
export { putJson } from './verbs/put'

export * from './types'
