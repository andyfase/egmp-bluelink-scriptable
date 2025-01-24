//
// FRAMES
//

import { clamp } from '../../../../common'
import { CycleTabsOwnState, Frame } from './types'

export const lastIndex = (totalTabs: number) => totalTabs - 1

const frame = (start: number, end: number, totalTabs: number): Frame => [
  clamp(start, 0, lastIndex(totalTabs)),
  clamp(end, 0, lastIndex(totalTabs)),
]

const isIndexWithinFrame = ([start, end]: Frame, activeIndex: number) => activeIndex >= start && activeIndex <= end

const fullFrame = (totalTabs: number) => frame(0, lastIndex(totalTabs), totalTabs)

const leftmostFrame = (maxPerPage: number, totalTabs: number) => frame(0, maxPerPage - 1, totalTabs)

const rightmostFrame = (totalTabs: number, maxPerPage: number) =>
  frame(lastIndex(totalTabs) - maxPerPage + 1, lastIndex(totalTabs), totalTabs)

const shiftFrameRight = ([start, end]: Frame, totalTabs: number) => frame(start + 1, end + 1, totalTabs)

const shiftFrameLeft = ([start, end]: Frame, totalTabs: number) => frame(start - 1, end - 1, totalTabs)

/** Get a frame with the active tab as far-left as possible. This is expected
 * when loading the first time. */
const getInitialFrame = (activeIndex: number, maxPerPage: number, totalTabs: number) => {
  const doesScroll = totalTabs > maxPerPage
  // If not scrollable, show all tabs
  if (!doesScroll) return fullFrame(totalTabs)
  // How many tabs exist from activeIndex to end (including activeIndex)
  const distanceFromActiveToEnd = totalTabs - activeIndex
  const canBeLeftAligned = distanceFromActiveToEnd > maxPerPage
  if (canBeLeftAligned) {
    return frame(activeIndex, activeIndex + maxPerPage - 1, totalTabs)
  }
  // Else, this frame must include the last tab
  return rightmostFrame(totalTabs, maxPerPage)
}

const getMovementDirection = ({ activeIndex, prevIndex }: CycleTabsOwnState, totalTabs: number) => {
  if (prevIndex === null) throw new Error('Invalid prevIndex value')
  const loopedAroundForward = activeIndex === 0 && prevIndex === lastIndex(totalTabs)
  if (loopedAroundForward) return 'FORWARD'
  const loopedAroundBackward = activeIndex === lastIndex(totalTabs) && prevIndex === 0
  if (loopedAroundBackward) return 'BACKWARD'
  return activeIndex > prevIndex ? 'FORWARD' : 'BACKWARD'
}

/** This is what is expected when scrolling through tabs: the frame doesn't
 * change until it needs to. */
const getFrameAvoidShifting = (state: CycleTabsOwnState, totalTabs: number, maxPerPage: number) => {
  const { currFrame, activeIndex } = state
  if (isIndexWithinFrame(currFrame, activeIndex)) return currFrame
  const movementDirection = getMovementDirection(state, totalTabs)
  if (movementDirection === 'FORWARD') {
    const mustLoop = currFrame[1] === lastIndex(totalTabs)
    return mustLoop ? leftmostFrame(maxPerPage, totalTabs) : shiftFrameRight(currFrame, totalTabs)
  } else {
    const mustLoop = currFrame[0] === 0
    return mustLoop ? rightmostFrame(totalTabs, maxPerPage) : shiftFrameLeft(currFrame, totalTabs)
  }
}

//
// STATE
//

const stateRegister: Map<string, CycleTabsOwnState> = new Map()

export const getState = (stateKey: string) => {
  const state = stateRegister.get(stateKey)
  if (!state) {
    throw new Error(`No cycle tabs state found for key ${stateKey}`)
  }
  return state
}

export const initState = <T extends string>(stateKey: string, maxPerPage: number, labels: T[], initValue?: T) => {
  if (stateRegister.has(stateKey)) return
  const totalTabs = labels.length
  const activeIndex = initValue ? labels.indexOf(initValue) : 0
  const currFrame = getInitialFrame(activeIndex, maxPerPage, totalTabs)
  stateRegister.set(stateKey, { activeIndex, prevIndex: null, currFrame })
}

export const setNewTabIndex = (stateKey: string, newTabIndex: number, totalTabs: number, maxPerPage: number) => {
  const currState = getState(stateKey)
  const partialNewState = {
    activeIndex: newTabIndex,
    prevIndex: currState.activeIndex,
  }
  stateRegister.set(stateKey, {
    ...partialNewState,
    currFrame: getFrameAvoidShifting({ ...currState, ...partialNewState }, totalTabs, maxPerPage),
  })
}
