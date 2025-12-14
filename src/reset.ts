import { Spacer, getTable, Div, P, destructiveConfirm, textInput } from './lib/scriptable-utils'

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
      P('Cliquer ici pour réinitialisé les paramètres par défault?', {
        /*  */ font: (n) => Font.boldSystemFont(n),
        fontSize: 25,
        align: 'center',
      }),
    ],
    {
      onTap() {
        destructiveConfirm(
          'Confirmer la réinitialisation des paramètres — toutes les données et tous les réglages seront supprimés',
          {
            confirmButtonTitle: 'EFFACER TOUS',
            onConfirm: () => {
              textInput('Confirmer le nom du script pour réinitialisé', {
                initValue: 'egmp-bluelink',
                submitText: 'Reset',
                onSubmit: (name) => {
                  if (name) {
                    name = name.replaceAll(' ', '')
                    keychain_keys.push(`egmp-scriptable-bl-cache-${name}`)
                    keychain_keys.push(`egmp-scriptable-config-${name}`)
                    keychain_keys.push(`egmp-scriptable-widget-${name}`)
                    for (const key of keychain_keys) {
                      if (Keychain.contains(key)) Keychain.remove(key)
                    }
                  }
                },
              })
            },
          },
        )
      },
    },
  )
}
