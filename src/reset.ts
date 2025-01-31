import { initRegionalBluelink } from 'lib/bluelink'
import { getConfig, deleteConfig } from 'config'
import { deleteWidgetCache } from 'widget'
import { loadTintedIcons } from './lib/util'
import { Spacer, getTable, Div, P, destructiveConfirm } from './lib/scriptable-utils'
import { Bluelink } from 'lib/bluelink-regions/base'
;(async () => {
  if (config.runsWithSiri || config.runsInWidget) {
    return
  }
  const blConfig = getConfig()
  const bl = await initRegionalBluelink(blConfig)

  await loadTintedIcons()

  const { present } = getTable<{
    foo: string
  }>({
    name: 'Reset',
  })

  return present({
    defaultState: {
      foo: 'foobar',
    },
    render: () => [Spacer({ rowHeight: 200 }), reset(bl)],
  })
})()

function reset(bl: Bluelink | Bluelink | undefined) {
  return Div(
    [
      P('Click me to Reset All Settings?', {
        font: (n) => Font.boldSystemFont(n),
        fontSize: 25,
        align: 'center',
      }),
    ],
    {
      onTap() {
        destructiveConfirm('Confirm Setting Reset - ALL settings/data will be removed', {
          confirmButtonTitle: 'Delete all Settings/Data',
          onConfirm: () => {
            if (bl) bl.deleteCache()
            try {
              deleteConfig()
            } catch {
              // do nothing it if fails as it didnt exist
            }
            try {
              deleteWidgetCache()
            } catch {
              // do nothing it if fails as it didnt exist
            }
            Script.complete()
          },
        })
      },
    },
  )
}
