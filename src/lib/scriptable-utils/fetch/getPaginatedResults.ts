import { getConfig } from '../configRegister'
import { destructiveConfirm } from '../input/confirm'
import { MaybePromise } from '../types/utilTypes'

type GetPaginatedResultsOptsShared<Response, Returns> = {
  initRequest: () => MaybePromise<Response>
  subsequentRequests: (prevResponse: Response) => MaybePromise<Response>
  /** Transforms raw response to the returned type */
  transformResponse?: (response: Response) => Returns
  /** Used to combine return data type (stitching page results together) */
  stitchData: (prevResults: Returns, newResult: Returns) => Returns
  isLastResponse: (prevResponse: Response) => boolean
  /** Optional callback to be performed each iteration of the recursive loop */
  onEachPageResult?: (pageResult: Returns) => any
}
type GetPaginatedResultsOptsExternal<Returns> = {
  /** Optional hook to perform action after completion of cycle */
  onEnd?: (results: Returns) => any
}
type GetPaginedResultsOptsInternal = {
  /** Count of requests so far */
  n?: number
}
export type GetPaginatedResultsOpts<Response, Returns> = GetPaginatedResultsOptsShared<Response, Returns> &
  GetPaginatedResultsOptsExternal<Returns>

const getPaginatedResultsRecur = async <Response, Returns>({
  initRequest,
  subsequentRequests,
  transformResponse = (response) => response as unknown as Returns,
  stitchData,
  isLastResponse,
  n = 1,
  onEachPageResult,
}: GetPaginatedResultsOptsShared<Response, Returns> & GetPaginedResultsOptsInternal): Promise<Returns> => {
  const initResponse = await initRequest()
  const initResult = transformResponse(initResponse)
  if (onEachPageResult) await onEachPageResult(initResult)
  if (isLastResponse(initResponse)) return initResult
  const MAX_LOOPS_BEFORE_WARNING = getConfig('GET_PAGINATED_RESULTS_MAX_LOOPS_BEFORE_WARNING')
  if (n === MAX_LOOPS_BEFORE_WARNING) {
    const shouldContinue = await destructiveConfirm('Continue requests?', {
      message: `You have already made ${MAX_LOOPS_BEFORE_WARNING} requests. Do you want to continue, or return the current results?`,
      cancelButtonTitle: 'Return current results',
      confirmButtonTitle: 'Continue',
    })
    if (!shouldContinue) return initResult
  }
  return stitchData(
    initResult,
    await getPaginatedResultsRecur({
      initRequest: () => subsequentRequests(initResponse),
      subsequentRequests,
      transformResponse,
      stitchData,
      isLastResponse,
      n: n + 1,
      onEachPageResult,
    }),
  )
}

export const getPaginatedResults = async <Response, Returns>(opts: GetPaginatedResultsOpts<Response, Returns>) => {
  const results = await getPaginatedResultsRecur(opts)
  if (opts.onEnd) await opts.onEnd(results)
  return results
}
