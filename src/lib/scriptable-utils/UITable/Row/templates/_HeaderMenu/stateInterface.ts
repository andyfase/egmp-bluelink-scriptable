import { ONE_SECOND } from '../../../../date'
import { HeaderMenuState, TableOpts } from './types'

const AUTO_CLOSE_IN = ONE_SECOND * 15

/** Every instantiation must provide a unique key to manage its state. */
const stateRegister: Record<string, HeaderMenuState> = {}

const getEntry = (stateKey: string): HeaderMenuState => {
  const entry = stateRegister[stateKey]
  if (entry) return entry
  const timer = new Timer()
  timer.timeInterval = AUTO_CLOSE_IN
  return { isExpanded: false, timer }
}

export const isHeaderMenuOpen = (stateKey: string) => getEntry(stateKey).isExpanded

const _setIsOpen = ({ name, rerenderParent, isTableActive }: TableOpts, isExpanded: boolean) => {
  const entry = getEntry(name)
  stateRegister[name] = { ...entry, isExpanded }
  if (isTableActive()) rerenderParent()
}

export const stopAllHeaderMenuTimers = () => {
  for (const { timer } of Object.values(stateRegister)) timer.invalidate()
}

/** When the menu is expanded, after some period of inactivity, close it
 * automatically. */
export const startAutoCloseTimer = (tableOpts: TableOpts) => {
  const { timer } = getEntry(tableOpts.name)
  timer.invalidate()
  timer.schedule(() => _setIsOpen(tableOpts, false))
}

const stopAutoCloseTimer = (stateKey: string) => getEntry(stateKey).timer.invalidate()

const openMenu = (tableOpts: TableOpts) => {
  _setIsOpen(tableOpts, true)
  startAutoCloseTimer(tableOpts)
}

export const closeHeaderMenu = (tableOpts: TableOpts) => {
  _setIsOpen(tableOpts, false)
  stopAutoCloseTimer(tableOpts.name)
}

export const toggleMenuExpansion = (tableOpts: TableOpts) => {
  const { name } = tableOpts
  if (isHeaderMenuOpen(name)) closeHeaderMenu(tableOpts)
  else openMenu(tableOpts)
}
