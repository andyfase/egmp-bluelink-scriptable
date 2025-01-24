import { isString } from './common'
import { ICONS } from './icons'

export const capitalize = (str: string) => str.slice(0, 1).toUpperCase() + str.slice(1).toLowerCase()

export const truncate = (str: string, maxLength: number) => {
  const isTruncated = str.length > maxLength
  return isTruncated ? str.slice(0, maxLength) + ICONS.ELLIPSIS : str
}

type TrimLinesOpts = { onlyTop?: boolean; onlyBottom?: boolean }
/**
 * Given array of strings, return array of lines removing all empty lines
 * at beginning and end of lines.
 */
export const trimLines = <T extends string>(lines: T[], { onlyTop, onlyBottom }: TrimLinesOpts = {}) => {
  const linePositions = { firstContentLine: -1, lastContentLine: -1 }
  let i = 0
  for (const line of lines) {
    const lineHasContent = line.trim().length > 0
    if (linePositions.firstContentLine === -1 && lineHasContent) {
      linePositions.firstContentLine = i
    }
    if (lineHasContent) linePositions.lastContentLine = i
    i++
  }
  const { firstContentLine, lastContentLine } = linePositions
  if (lastContentLine === -1) return []
  if (onlyTop) return lines.slice(firstContentLine)
  if (onlyBottom) return lines.slice(0, lastContentLine + 1)
  return lines.slice(firstContentLine, lastContentLine + 1)
}

/** Wrapper for trimLines that accepts string, rather than string[] */
export const trimLinesOfString = (str: string) => trimLines(str.split('\n')).join('\n')

/** Input space-separated words, returns camelCasedResult */
export const camelCase = (sentence: string) =>
  sentence.split(' ').reduce((acc, word, i) => acc + (i === 0 ? word.toLowerCase() : capitalize(word)), '')

/** Very simplistic algorithm */
export const pluralize = (singularWord: string, count: number) => `${singularWord}${count === 1 ? '' : 's'}`

export const lowerIncludes = (containingStringOrArr: string | string[], query: string) => {
  return isString(containingStringOrArr)
    ? containingStringOrArr.toLowerCase().includes(query.toLowerCase())
    : containingStringOrArr.some((arrVal) => arrVal.toLowerCase() === query.toLowerCase())
}

export const lowerEquals = (s1: string, s2: string) => s1.toLowerCase() === s2.toLowerCase()

export const escapeQuotesHTML = (str: string) => str.replaceAll("'", '&apos;').replaceAll('"', '&quot;')

export const splitByRegex = (str: string, regex: RegExp) => {
  const uniqueRegexReplacer = UUID.string()
  const globalRegex = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g')
  const withUniqueDividers = str.replace(globalRegex, uniqueRegexReplacer)
  return withUniqueDividers.split(uniqueRegexReplacer)
}

export const tidyLog = (message: any) => console.log(JSON.stringify(message, null, 2))

export const extractLinks = (text: string) => {
  const matches = text.match(/[a-z-]+:\/\/\S*/gim)
  return matches ? [...matches] : []
}

/** `Array.splice` mutates the source array and returns the spliced elements.
 * This rather clones the array, and returns the clone after being spliced */
export const spliceInPlace = <T, U>(arr: T[], startIndex: number, deleteCount: number, ...items: U[]) => {
  const shallowClone: (T | U)[] = [...arr]
  shallowClone.splice(startIndex, deleteCount, ...items)
  return shallowClone
}

const countChar = (string: string, char: string) => string.split(char).length - 1

export const isID = (val: any): val is string => isString(val) && countChar(val, '-') === 4

export const prefixEachLine = (str: string, prefix: string) =>
  str
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n')
