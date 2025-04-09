import { Spacer, getTable, Div, P, destructiveConfirm } from './lib/scriptable-utils'
import { deleteWidgetCache } from 'widget'
import { deleteConfig } from 'config'
import { Bluelink } from 'lib/bluelink-regions/base'

const keychain_keys = ['egmp-bluelink-config', 'egmp-bluelink-cache', 'egmp-bluelink-widget']

;(async () => {
  if (config.runsWithSiri || config.runsInWidget) {
    return
  }

  const { present } = getTable<{
    foo: string
  }>({
    name: 'Reset',
  })

  return present({
    defaultState: {
      foo: 'foobar',
    },
    render: () => [Spacer({ rowHeight: 200 }), reset()],
  })
})()

function reset() {
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
            for (const key of keychain_keys) {
              if (Keychain.contains(key)) Keychain.remove(key)
            }
            deleteWidgetCache()
            deleteConfig()
            Bluelink.deleteCache()
          },
        })
      },
    },
  )
}
