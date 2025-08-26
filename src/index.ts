import { initRegionalBluelink } from 'lib/bluelink'
import { getBluelinkLogger } from 'lib/bluelink-regions/base'
import { getWidgetLogger } from 'widget'
import {
  createSmallWidget,
  createMediumWidget,
  createHomeScreenCircleWidget,
  createHomeScreenRectangleWidget,
  createErrorWidget,
} from 'widget'
import { createApp } from 'app'
import { getAppLogger } from './lib/util'
import { processSiriRequest } from 'siri'
import { getConfig, loadConfigScreen, configExists, setConfig } from 'config'
import { confirm, quickOptions } from './lib/scriptable-utils'
;(async () => {
  // load config on first run if not configured
  if (!configExists() && (config.runsWithSiri || config.runsInWidget)) return
  if (!configExists()) {
    await loadConfigScreen()
    return
  }

  const logger = getAppLogger()
  const blConfig = getConfig()
  let bl = undefined

  // Init Bluelink - Deal with region exceptions if needed
  try {
    bl = await initRegionalBluelink(blConfig)
  } catch (e) {
    const error = e instanceof Error ? e.message : e
    const errorMessage = `Error Initalizing Bluelink: ${error}`
    const errorMessageShort = errorMessage.replace(/\{.*\}/, '')
    logger.log(errorMessage)
    if (!config.runsWithSiri && !config.runsInWidget) {
      await quickOptions(['Ok', 'Settings', 'Share Debug Logs'], {
        title: errorMessageShort,
        onOptionSelect: async (opt) => {
          if (opt === 'Ok') return
          switch (opt) {
            case 'Share Debug Logs': {
              const blRedactedLogs = getBluelinkLogger().readAndRedact()
              const widgetLogs = getWidgetLogger().read()
              const appLogs = getAppLogger().read()
              await ShareSheet.present([
                'Bluelink API logs:',
                blRedactedLogs,
                'Widget Logs',
                widgetLogs,
                'App Logs',
                appLogs,
              ])
              break
            }
            case 'Settings': {
              await loadConfigScreen()
              break
            }
          }
        },
      })
    } else {
      if (config.runsInWidget) {
        Script.setWidget(createErrorWidget(errorMessage))
      } else {
        Script.setShortcutOutput(errorMessage)
      }
      Script.complete()
    }
    return
  }

  // deal with login failure, multiple car selection - main app only
  if (!bl || bl.loginFailed()) {
    if (config.runsWithSiri || config.runsInWidget) {
      return
    }
    if (bl && bl.loginFailed()) {
      // check for car option selection
      const carOptions = bl.getCarOptions()
      if (carOptions.length > 0) {
        const carOptionsNames = carOptions.map((car) => ({
          name: car.nickName.length > 0 ? `${car.nickName} - ${car.modelName}` : `${car.modelYear} ${car.modelName}`,
          vin: car.vin,
        }))
        await quickOptions(
          carOptionsNames.map((car) => car.name),
          {
            title: 'Multiple cars found, choose your EV',
            onOptionSelect: (opt) => {
              const selectedCar = carOptionsNames.find((car) => car.name === opt)
              if (selectedCar) {
                blConfig.vin = selectedCar.vin
                setConfig(blConfig)
              }
            },
          },
        )
      } else {
        await confirm('Login Failed - please re-check your credentials', {
          confirmButtonTitle: 'Ok',
          includeCancel: false,
        })
        await loadConfigScreen()
        return
      }
    }

    if (!bl) {
      logger.log('Bluelink instance is undefined')
      await confirm('Something went wrong initalizing Bluelink - try again later', {
        confirmButtonTitle: 'Ok',
        includeCancel: false,
      })
      return
    }
  }

  // actual app / widget / siri response handiling
  if (config.runsInWidget) {
    let widget = undefined
    switch (config.widgetFamily) {
      case 'accessoryCircular':
        widget = await createHomeScreenCircleWidget(blConfig, bl)
        break
      case 'accessoryRectangular':
        widget = await createHomeScreenRectangleWidget(blConfig, bl)
        break
      case 'small':
        widget = await createSmallWidget(blConfig, bl)
        break
      default:
        widget = await createMediumWidget(blConfig, bl)
        break
    }
    Script.setWidget(widget)
    Script.complete()
  } else if (config.runsWithSiri) {
    Script.setShortcutOutput(await processSiriRequest(blConfig, bl, args.shortcutParameter))
    Script.complete()
  } else {
    try {
      // check if we need to restart script - needed to clear out any login webviews
      if (bl.needRestart()) {
        logger.log('Restarting script to clear webview')
        const scriptUrl = URLScheme.forRunningScript()
        Safari.open(scriptUrl)
        return
      }

      const resp = await createApp(blConfig, bl)
      // @ts-ignore - undocumented api
      App.close() // add this back after dev
      Script.complete()
      return resp
    } catch (error) {
      logger.log(`main error ${JSON.stringify(error)}`)
    }
  }
})()
