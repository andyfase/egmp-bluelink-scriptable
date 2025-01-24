import { getColor } from '../colors'
import { objectEntries } from '../object'
import { SFSymbolKey, sfSymbolsMap } from '../sfSymbols'
import { capitalize, lowerIncludes } from '../string'
import { ThreeCol } from '../UITable/elements'
import selectableEntityBrowser from '../views/selectableEntityBrowser'

type SymbolData = { key: SFSymbolKey; value: string }

export default async (initValue?: SFSymbolKey) => {
  const result: { sfSymbolKey?: SFSymbolKey } = { sfSymbolKey: initValue }

  await selectableEntityBrowser({
    getEntities: () =>
      objectEntries(sfSymbolsMap).map<SymbolData>(([key, value]) => ({
        key,
        value,
      })),
    getEntityRow: ({ entity: { key }, onTap }) =>
      ThreeCol({
        icon: key,
        text: capitalize(key),
        ...(key === result.sfSymbolKey && {
          bgColor: getColor('selectedBgColor'),
        }),
        onTap,
        borderTop: 1,
        borderBottom: 1,
      }),
    getEntityId: ({ key }) => key,
    openEntity: ({ entity: { key }, rerender }) => {
      result.sfSymbolKey = key
      rerender()
    },
    getCustomCTAs: () => {
      const currKey = result.sfSymbolKey
      return [
        {
          text: currKey ? `Selected: ${currKey}` : 'No selection',
          icon: currKey ?? 'dot_in_circle',
          isFaded: !currKey,
        },
      ]
    },
    getSearchMatchPredicate:
      (query) =>
      ({ key, value }) =>
        lowerIncludes(key, query) || lowerIncludes(value, query),
    headerOpts: { title: 'Icon picker' },
  })

  return result.sfSymbolKey
}
