import { initRegionalBluelink } from 'lib/bluelink'
import { createWidget } from 'widget'
import { createApp } from 'app'
import { processSiriRequest } from 'siri'
import { getConfig, loadConfigScreen, configExists } from 'config'
import { confirm } from './lib/scriptable-utils'
;(async () => {
  if (!configExists() && (config.runsWithSiri || config.runsInWidget)) return
  const blConfig = getConfig()
  const bl = await initRegionalBluelink(blConfig)

  if (!bl || bl.loginFailed()) {
    if (config.runsWithSiri || config.runsInWidget) {
      return
    }
    await confirm('Login Failed - please re-check your credentials', {
      confirmButtonTitle: 'Ok',
      includeCancel: false,
    })
    await loadConfigScreen()
    return
  }

  if (config.runsInWidget) {
    const widget = await createWidget(blConfig, bl)
    Script.setWidget(widget)
    Script.complete()
  } else if (config.runsWithSiri) {
    Script.setShortcutOutput(await processSiriRequest(blConfig, bl, args.shortcutParameter))
    Script.complete()
  } else {
    try {
      const resp = await createApp(blConfig, bl)
      // @ts-ignore - undocumented api
      App.close() // add this back after dev
      return resp
    } catch (error) {
      logError(error)
    }
  }
})()
