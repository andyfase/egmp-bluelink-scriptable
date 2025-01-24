import { insertBetween } from '../../array'
import { compose, filter, map, toArray } from '../../arrayTransducers'
import { isNumber } from '../../common'
import { splitByRegex } from '../../string'
import { MultipartOpts } from './types'

/** Response uses \r for linebreak (gmail API, at least), normalize all to be \n */
const normalizeLineBreaks = (str: string) => str.replaceAll('\r', '\n')

/**
 * Each multipart response chunk has headers & JSON data returned.
 * Presumably there could be multipart responses that don't return data inside
 * curly braces, but this should probably work for most use cases.
 * This also assumes that the JSON data is formatted & split across newlines,
 * which is is the case for Gmail at least.
 */
const extractJSONDataFromMultipartChunk = <R>(lines: string[]) => {
  const multipartBrackets: [number | null, number | null] = [null, null]
  let i = 0
  for (const line of lines) {
    if (multipartBrackets[0] === null && line === '{') multipartBrackets[0] = i
    if (line === '}') multipartBrackets[1] = i
    i++
  }
  const [firstOpen, lastClose] = multipartBrackets
  if (!(isNumber(firstOpen) && isNumber(lastClose))) throw new Error('No JSON data to extract!')
  const jsonStr = lines.slice(firstOpen, lastClose + 1).join('\n')
  return JSON.parse(jsonStr) as R
}

export const extractMultipartResponseArray = <R>(response: string) => {
  const splitByBoundaryLikeString = splitByRegex(response, /(\r|\n)--[^ ]+(\r|\n)/)
  return toArray(
    splitByBoundaryLikeString,
    compose(
      filter(Boolean),
      map(normalizeLineBreaks),
      filter((chunk) => Boolean(chunk.replaceAll('\n', ''))),
      map((chunk) => extractJSONDataFromMultipartChunk<R>(chunk.split('\n'))),
    ),
  )
}

export const getMultipartBody = ({ requests, boundary }: Required<Pick<MultipartOpts, 'requests' | 'boundary'>>) => {
  const requestBlocks = requests.map(({ contentType, method, url, body }) =>
    [
      `Content-Type: ${contentType}`,
      '',
      `${method} ${url}`,
      ...(body ? ['', ...JSON.stringify(body).split('\n')] : []),
    ].join('\n'),
  )
  const boundaryStr = `--${boundary}`
  const bodyStr = [boundaryStr, ...insertBetween(requestBlocks, boundaryStr), `${boundaryStr}--`].join('\n')
  return Data.fromString(bodyStr).toRawString()
}
