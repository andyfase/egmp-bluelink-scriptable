import { conditionalArr } from '../../../../array'
import { cycle } from '../../../../flow'
import Row from '../../Row'
import { BackCyclingSpacer, getStyle, ScrollLeftIndicator, ScrollRightIndicator, Tab, UnderlineCell } from './atoms'
import { CycleTabsOpts } from './types'
import { getState, initState, lastIndex, setNewTabIndex } from './utils'

export default <T extends string>({
  labels,
  initValue,
  mapLabel,
  onTabChange,
  subtle = false,
  maxPerPage = Device.isPad() ? 4 : 3,
  name,
  rerenderParent,
}: CycleTabsOpts<T>) => {
  initState(name, maxPerPage, labels, initValue)
  const { currFrame } = getState(name)
  const totalTabs = labels.length

  const cycleForward = () => {
    const nextTab = cycle(initValue, labels)
    onTabChange({ currTab: initValue, nextTab })
    setNewTabIndex(name, labels.indexOf(nextTab), totalTabs, maxPerPage)
    rerenderParent()
  }

  const cycleBack = () => {
    const currIndex = labels.indexOf(initValue)
    const newIndex = currIndex ? currIndex - 1 : labels.length - 1
    onTabChange({ currTab: initValue, nextTab: labels[newIndex]! })
    setNewTabIndex(name, newIndex, totalTabs, maxPerPage)
    rerenderParent()
  }

  const doesScroll = totalTabs > maxPerPage
  const areHiddenToLeft = currFrame[0] !== 0
  const areHiddenToRight = doesScroll && currFrame[1] !== lastIndex(totalTabs)
  const shownLabels = labels.slice(currFrame[0], currFrame[0] + maxPerPage)

  return [
    BackCyclingSpacer(cycleBack),
    BackCyclingSpacer(cycleBack),
    Row({
      content: conditionalArr([
        areHiddenToLeft ? ScrollLeftIndicator() : { isEmpty: true },
        ...shownLabels.map((label) => Tab(label, maxPerPage, { mapLabel, initValue, subtle })),
        areHiddenToRight ? ScrollRightIndicator() : { isEmpty: true },
      ]),
      onTap: cycleForward,
      padding: { paddingBottom: 0 },
      rowHeight: getStyle('rowHeight', subtle),
    }),
    Row({
      content: [
        { isEmpty: true },
        ...shownLabels.map((label) => UnderlineCell(label === initValue, subtle, maxPerPage)),
        { isEmpty: true },
      ],
      onTap: cycleForward,
      padding: { paddingTop: 0, paddingBottom: 0 },
      rowHeight: getStyle('underlineRowHeight', subtle),
    }),
  ].flat()
}
