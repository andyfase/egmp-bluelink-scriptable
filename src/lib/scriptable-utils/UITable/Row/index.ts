import { HeightOpts, parseHeightVals } from './utils'

export const getRowHeight = (opts: HeightOpts) => {
  const { padding, rowHeight } = parseHeightVals(opts)
  return rowHeight + padding.paddingBottom + padding.paddingTop
}

export { default as Row } from './Row'
export * from './templates'
export * from './base'
export * from './types'
export * from './flavors'
