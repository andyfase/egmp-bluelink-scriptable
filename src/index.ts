import { initRegionalBluelink } from 'lib/bluelink'
import {
  createSmallWidget,
  createMediumWidget,
  createHomeScreenCircleWidget,
  createHomeScreenRectangleWidget,
} from 'widget'
import { createApp } from 'app'
import { getAppLogger } from './lib/util'
import { processSiriRequest } from 'siri'
import { getConfig, loadConfigScreen, configExists, setConfig } from 'config'
import { confirm, quickOptions } from './lib/scriptable-utils'
;(async () => {
  if (!configExists() && (config.runsWithSiri || config.runsInWidget)) return
  if (!configExists()) {
    await loadConfigScreen()
    return
  }

  const logger = getAppLogger()
  logger.log(`name: ${Script.name()}`)
  const blConfig = getConfig()
  const bl = await initRegionalBluelink(blConfig)

  if (!bl || bl.loginFailed()) {
    if (config.runsWithSiri || config.runsInWidget) {
      return
    }
    if (bl && bl.loginFailed()) {
      // check for car option selection
      const carOptions = bl.getCarOptions()
      if (carOptions) {
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
      }
    } else {
      await confirm('Login Failed - please re-check your credentials', {
        confirmButtonTitle: 'Ok',
        includeCancel: false,
      })
      await loadConfigScreen()
      return
    }
  }

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
