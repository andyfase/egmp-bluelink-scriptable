import { conditionalArr } from '../../../../array'
import { ExcludeFalsy } from '../../../../common'
import { NoParamFn, Omit_ } from '../../../../types/utilTypes'
import { ButtonStack } from '../_Button'
import _Spacer from '../_Spacer'
import { closeHeaderMenu, isHeaderMenuOpen, startAutoCloseTimer, toggleMenuExpansion } from './stateInterface'
import { HeaderMenuButtonOpts, HeaderMenuOpts, TableOpts } from './types'

const composeOnTap =
  (shouldCollapseMenu: boolean, onTap: NoParamFn, dismissOnTap: boolean | undefined, tableOpts: TableOpts) => () => {
    // If tapping collapses menu, or dismisses table, stop the timer. Else, the
    // default behavior is to restart the timer for closing the menu.
    const shouldKeepMenuOpenLonger = !shouldCollapseMenu && !dismissOnTap
    if (shouldKeepMenuOpenLonger) startAutoCloseTimer(tableOpts)
    else closeHeaderMenu(tableOpts)
    return onTap()
  }

const hijackOnTaps = (
  {
    onTap,
    onDoubleTap,
    onTripleTap,
    shouldNotCollapseMenuOnNTap: { single, double, triple } = {},
    dismissOnTap,
  }: HeaderMenuButtonOpts,
  tableOpts: TableOpts,
) => {
  const composer = (shouldCollapseMenu: boolean, onTapFn: NoParamFn) =>
    composeOnTap(shouldCollapseMenu, onTapFn, dismissOnTap, tableOpts)
  return {
    ...(onTap && { onTap: composer(!single, onTap) }),
    ...(onDoubleTap && { onDoubleTap: composer(!double, onDoubleTap) }),
    ...(onTripleTap && { onTripleTap: composer(!triple, onTripleTap) }),
  }
}

const getEnhancedSettingOpts = (
  opts: HeaderMenuButtonOpts,
  tableOpts: TableOpts,
): Omit_<HeaderMenuButtonOpts, 'shouldNotCollapseMenuOnNTap'> => ({
  ...opts,
  ...hijackOnTaps(opts, tableOpts),
})

export default ({
  name,
  icon = 'hamburger',
  iconWhileOpen = 'x_in_square',
  text = '',
  textWhileOpen,
  settingOpts,
  rerenderParent,
  isTableActive,
}: HeaderMenuOpts) => {
  const isThisOpen = isHeaderMenuOpen(name)
  const tableOpts = { name, rerenderParent, isTableActive }

  return conditionalArr([
    ButtonStack([
      {
        text: isThisOpen ? (textWhileOpen ?? text) : text,
        icon: isThisOpen ? iconWhileOpen : icon,
        onTap: () => toggleMenuExpansion(tableOpts),
        flavor: isThisOpen ? 'sereneH1' : 'transparentH1',
        isLarge: true,
      },
      ...(isThisOpen ? settingOpts.filter(ExcludeFalsy).map((opts) => getEnhancedSettingOpts(opts, tableOpts)) : []),
    ]),
    isThisOpen && _Spacer(),
  ]).flat()
}

export * from './types'
