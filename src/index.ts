import { createWidget } from 'widget'
import { createApp } from 'app'
import { processSiriRequest } from 'siri'
import { getConfig, loadConfigScreen, configExists } from 'config'
;(async () => {
  if (config.runsInWidget && configExists()) {
    const widget = await createWidget(getConfig())
    Script.setWidget(widget)
    Script.complete()
  } else if (config.runsWithSiri && configExists()) {
    Script.setShortcutOutput(await processSiriRequest(getConfig(), args.shortcutParameter))
    Script.complete()
  } else {
    try {
      const resp = configExists() ? await createApp(getConfig()) : await loadConfigScreen()
      // @ts-ignore - undocumented api
      App.close() // add this back after dev
      return resp
    } catch (error) {
      logError(error)
    }
  }
})()
