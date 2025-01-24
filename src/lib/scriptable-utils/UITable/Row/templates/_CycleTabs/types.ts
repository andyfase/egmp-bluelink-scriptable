import { NoParamFn } from '../../../../types/utilTypes'

export type CycleTabsOpts<T extends string = string> = {
  name: string
  rerenderParent: NoParamFn
  labels: T[]
  initValue: T
  /** Used to transform the label (T) to a formatted string. E.g. if T were
   * GmailConnectionKey, you may want to transform "gmailPersonal" to "Personal" */
  mapLabel?: (rawLabel: T) => string
  /** "Next tab" is the tab switched to immediately after tapping */
  onTabChange: (data: { currTab: T; nextTab: T }) => any
  /** Smaller underline */
  subtle?: boolean
  maxPerPage?: number
}

/** A "frame" is a slice of the tabs. It is beginning and ending indices,
 * inclusive, and its length is always <= maxPerPage */
export type Frame = [firstShown: number, lastShown: number]

export type CycleTabsOwnState = {
  activeIndex: number
  prevIndex: number | null
  currFrame: Frame
}
