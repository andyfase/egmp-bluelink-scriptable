import { createWidget } from 'widget'
import { createApp } from 'app'
import { getConfig, loadConfigScreen, configExists } from 'config'
;(async () => {
  if (config.runsInWidget && configExists()) {
    const widget = await createWidget(getConfig())
    Script.setWidget(widget)
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
