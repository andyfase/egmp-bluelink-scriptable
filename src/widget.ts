import {
  getTintedIconAsync,
  getBatteryPercentColor,
  calculateBatteryIcon,
  getChargingIcon,
  dateStringOptions,
  getChargeCompletionString,
  getChargingPowerString,
  sleep,
} from './lib/util'
import { Bluelink, Status } from './lib/bluelink-regions/base'
import { Config } from 'config'
import { Logger } from './lib/logger'

// Widget Config
const DARK_MODE = true // Device.isUsingDarkAppearance(); // or set manually to (true or false)
const DARK_BG_COLOR = '000000'
const LIGHT_BG_COLOR = 'FFFFFF'

const KEYCHAIN_WIDGET_REFRESH_KEY = 'egmp-bluelink-widget'

// Definition of Day/Night Hours
const NIGHT_HOUR_START = 23
const NIGHT_HOUR_STOP = 7

let WIDGET_LOGGER: Logger | undefined = undefined
const WIDGET_LOG_FILE = `${Script.name().replaceAll(' ', '')}-widget.log`

interface WidgetRefreshCache {
  lastRemoteRefresh: number
  lastCommand: 'API' | 'REMOTE'
}

const DEFAULT_WIDGET_CACHE = {
  lastRemoteRefresh: 0,
  lastCommand: 'API',
} as WidgetRefreshCache

interface WidgetRefresh {
  nextRefresh: Date
  status: Status
}

export function getWidgetLogger(): Logger {
  if (!WIDGET_LOGGER) WIDGET_LOGGER = new Logger(WIDGET_LOG_FILE, 100)
  return WIDGET_LOGGER
}

function getCacheKey(write = false): string {
  const newCacheKey = `egmp-scriptable-widget-${Script.name().replaceAll(' ', '')}`
  if (write || Keychain.contains(newCacheKey)) return newCacheKey
  return KEYCHAIN_WIDGET_REFRESH_KEY
}

export function deleteWidgetCache() {
  Keychain.remove(getCacheKey(true))
}

async function waitForCommandSent(
  bl: Bluelink,
  sleepTime = 200,
  startTime = Date.now(),
  counter = 1,
): Promise<boolean> {
  const lastCommand = bl.getLastCommandSent()
  if (lastCommand && lastCommand > startTime) return true
  if (counter > 10) return false
  await sleep(sleepTime)
  return await waitForCommandSent(bl, sleepTime, startTime, counter + 1)
}

async function refreshDataForWidgetWithTimeout(bl: Bluelink, config: Config, timeout = 4000): Promise<WidgetRefresh> {
  const logger = getWidgetLogger()
  const timer = Timer.schedule(timeout, false, () => {
    if (config.debugLogging) logger.log(`Timeout refreshing data for widget - failing back to cached data`)
    return {
      status: bl.getCachedStatus(),
      nextRefresh: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes by default if call timeouts
    }
  })

  const result = await refreshDataForWidget(bl, config)
  timer.invalidate()
  return result
}

async function refreshDataForWidget(bl: Bluelink, config: Config): Promise<WidgetRefresh> {
  const logger = getWidgetLogger()

  const MIN_API_REFRESH_TIME = 300000 // 5 minutes

  // Day Intervals - day lasts for 16 days - in milliseconds
  const DEFAULT_STATUS_CHECK_INTERVAL_DAY = 3600 * config.widgetConfig.standardPollPeriod * 1000
  const DEFAULT_REMOTE_REFRESH_INTERVAL_DAY = 3600 * config.widgetConfig.remotePollPeriod * 1000
  const DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL_DAY = 3600 * config.widgetConfig.chargingRemotePollPeriod * 1000

  // Night Intervals - night lasts for 8 hours - in milliseconds
  const DEFAULT_STATUS_CHECK_INTERVAL_NIGHT = 3600 * config.widgetConfig.nightStandardPollPeriod * 1000
  const DEFAULT_REMOTE_REFRESH_INTERVAL_NIGHT = 3600 * config.widgetConfig.nightRemotePollPeriod * 1000
  const DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL_NIGHT = 3600 * config.widgetConfig.nightChargingRemotePollPeriod * 1000

  let cache: WidgetRefreshCache | undefined = undefined
  const currentTimestamp = Date.now()
  const currentHour = new Date().getHours()

  // Set status periods based on day/night
  let DEFAULT_STATUS_CHECK_INTERVAL = DEFAULT_STATUS_CHECK_INTERVAL_NIGHT
  let DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL = DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL_NIGHT
  let DEFAULT_REMOTE_REFRESH_INTERVAL = DEFAULT_REMOTE_REFRESH_INTERVAL_NIGHT
  if (currentHour < NIGHT_HOUR_START && currentHour > NIGHT_HOUR_STOP) {
    DEFAULT_STATUS_CHECK_INTERVAL = DEFAULT_STATUS_CHECK_INTERVAL_DAY
    DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL = DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL_DAY
    DEFAULT_REMOTE_REFRESH_INTERVAL = DEFAULT_REMOTE_REFRESH_INTERVAL_DAY
  }

  if (Keychain.contains(getCacheKey())) {
    cache = {
      ...DEFAULT_WIDGET_CACHE,
      ...JSON.parse(Keychain.get(getCacheKey())),
    }
  }
  if (!cache) {
    cache = DEFAULT_WIDGET_CACHE
  }
  let status = bl.getCachedStatus()

  // Get last remote check from cached API and convert
  // then compare to cache.lastRemoteRefresh and use whatever value is greater
  // we have both as we may have requested a remote refresh and that request is still pending

  let lastRemoteCheck = status.status.lastRemoteStatusCheck
  lastRemoteCheck = lastRemoteCheck > cache.lastRemoteRefresh ? lastRemoteCheck : cache.lastRemoteRefresh

  // LOGIC for refresh within widget
  // 1.Force refresh if user opted in via config AND last remote check is older than:
  //   - DEFAULT_REMOTE_REFRESH_INTERVAL if NOT charging
  //   - DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL if charging
  // 2. Normal refresh if not #1
  // The time intervals vary based on day/night - with day being more frequent

  const chargeCompletionTime = status.status.isCharging
    ? status.status.lastRemoteStatusCheck + status.status.remainingChargeTimeMins * 60 * 1000
    : 0

  const chargingComplete = status.status.isCharging && chargeCompletionTime < currentTimestamp
  if (status.status.isCharging && config.debugLogging)
    logger.log(
      `Now:${currentTimestamp}, Charge Completion Time: ${chargeCompletionTime}, chargingComplete: ${chargingComplete}`,
    )

  const chargingAndOverRemoteRefreshInterval =
    status.status.isCharging && lastRemoteCheck + DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL < currentTimestamp

  const notChargingAndOverRemoteRefreshInterval =
    !status.status.isCharging && lastRemoteCheck + DEFAULT_REMOTE_REFRESH_INTERVAL < currentTimestamp

  // calculate next remote check - reset if calculated value is in the past
  // if charging ends before next remote check use charge end + 10 minutes
  const remoteRefreshInterval = status.status.isCharging
    ? DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL
    : DEFAULT_REMOTE_REFRESH_INTERVAL
  let nextRemoteRefreshTime = lastRemoteCheck + remoteRefreshInterval
  if (nextRemoteRefreshTime < currentTimestamp) nextRemoteRefreshTime = currentTimestamp + remoteRefreshInterval
  if (status.status.isCharging) {
    if (chargeCompletionTime + 10 * 60 * 1000 < nextRemoteRefreshTime) {
      nextRemoteRefreshTime = chargeCompletionTime + 10 * 60 * 1000
      if (nextRemoteRefreshTime < currentTimestamp) nextRemoteRefreshTime = currentTimestamp + 5 * 60 * 1000
    }
  }

  // nextAPIRefreshTime is always based on DEFAULT_STATUS_CHECK_INTERVAL as its the default option
  const nextAPIRefreshTime = currentTimestamp + DEFAULT_STATUS_CHECK_INTERVAL

  // choose the lowest of the two values.
  const lowestRefreshTime = nextAPIRefreshTime < nextRemoteRefreshTime ? nextAPIRefreshTime : nextRemoteRefreshTime
  let nextRefresh = new Date(lowestRefreshTime)

  try {
    if (
      config.allowWidgetRemoteRefresh &&
      cache.lastCommand !== 'REMOTE' &&
      (chargingComplete || chargingAndOverRemoteRefreshInterval || notChargingAndOverRemoteRefreshInterval)
    ) {
      // Note a remote refresh takes to long to wait for - so trigger it and set a small nextRefresh value to pick
      // up the remote data on the next widget refresh
      if (config.debugLogging) logger.log('Doing Remote Refresh')
      bl.getStatus(true, true) // no await deliberatly as it takes to long to complete

      //wait for getCar command to be completed + another 200ms to ensure the remote status command is sent
      const result = await waitForCommandSent(bl, 200)
      if (result) {
        await sleep(200)
        cache.lastRemoteRefresh = currentTimestamp
        cache.lastCommand = 'REMOTE'
        if (config.debugLogging) logger.log('Completed Remote Refresh')
      } else {
        if (config.debugLogging) logger.log('Remote status command failed to send')
      }
      nextRefresh = new Date(Date.now() + 5 * 60 * 1000)
    } else if (chargingComplete || currentTimestamp > status.status.lastStatusCheck + MIN_API_REFRESH_TIME) {
      if (config.debugLogging) logger.log('Doing API Refresh')
      status = await bl.getStatus(false, true)
      cache.lastCommand = 'API'
      if (config.debugLogging) logger.log('Completed API Refresh')
    }
  } catch (_error) {
    // ignore any API errors and just displayed last cached values in widget
    // we have no guarentee of network connection
  }

  Keychain.set(getCacheKey(true), JSON.stringify(cache))
  if (config.debugLogging)
    logger.log(
      `Current time: ${new Date().toLocaleString()}. cache: ${JSON.stringify(cache)}, Last Remote Check: ${new Date(lastRemoteCheck).toLocaleString()} Setting next widget refresh to ${nextRefresh.toLocaleString()}`,
    )

  return {
    nextRefresh: nextRefresh,
    status: status,
  }
}

export async function createMediumWidget(config: Config, bl: Bluelink) {
  const refresh = await refreshDataForWidgetWithTimeout(bl, config)
  const status = refresh.status

  // Prepare image
  const appIcon = await bl.getCarImage(config.carColor)
  const title = status.car.nickName || `${status.car.modelYear} ${status.car.modelName}`

  // define widget and set date for when the next refresh should not occur before.
  const widget = new ListWidget()
  widget.setPadding(20, 5, 20, 15)
  widget.refreshAfterDate = refresh.nextRefresh

  const mainStack = widget.addStack()
  mainStack.layoutVertically()

  // Add background color
  widget.backgroundColor = DARK_MODE ? new Color(DARK_BG_COLOR) : new Color(LIGHT_BG_COLOR)

  // Show app icon and title
  mainStack.addSpacer()
  const titleStack = mainStack.addStack()
  titleStack.addSpacer(10)
  const titleElement = titleStack.addText(title)
  titleElement.textColor = DARK_MODE ? Color.white() : Color.black()
  titleElement.textOpacity = 0.7
  titleElement.font = Font.mediumSystemFont(25)
  titleStack.addSpacer()
  const appIconElement = titleStack.addImage(appIcon)
  appIconElement.imageSize = new Size(40, 40 / (appIcon.size.width / appIcon.size.height))
  appIconElement.centerAlignImage()
  mainStack.addSpacer()

  // space
  if (!status.status.isCharging) mainStack.addSpacer()

  // Center Stack
  const contentStack = mainStack.addStack()
  const carImageElement = contentStack.addImage(appIcon)
  carImageElement.imageSize = new Size(180, 180 / (appIcon.size.width / appIcon.size.height))
  // contentStack.addSpacer()

  // Battery Info
  const batteryInfoStack = contentStack.addStack()
  batteryInfoStack.layoutVertically()
  batteryInfoStack.addSpacer()

  // Range
  const rangeStack = batteryInfoStack.addStack()
  rangeStack.addSpacer()
  const rangeText = `${status.status.range} ${bl.getDistanceUnit()}`
  const rangeElement = rangeStack.addText(rangeText)
  rangeElement.font = Font.mediumSystemFont(20)
  rangeElement.textColor = DARK_MODE ? Color.white() : Color.black()
  rangeElement.rightAlignText()
  // batteryInfoStack.addSpacer()

  // set status from BL status response
  const isCharging = status.status.isCharging
  const isPluggedIn = status.status.isPluggedIn
  const batteryPercent = status.status.soc
  const remainingChargingTime = status.status.remainingChargeTimeMins
  const chargingKw = getChargingPowerString(status.status.chargingPower)
  const odometer =
    status.car.odometer === undefined
      ? status.status.odometer
      : status.status.odometer >= status.car.odometer
        ? status.status.odometer
        : status.car.odometer
  const lastSeen = new Date(status.status.lastRemoteStatusCheck)

  // Battery Percent Value
  const batteryPercentStack = batteryInfoStack.addStack()
  batteryPercentStack.addSpacer()
  batteryPercentStack.centerAlignContent()
  const image = await getTintedIconAsync(calculateBatteryIcon(batteryPercent))
  const batterySymbolElement = batteryPercentStack.addImage(image)
  batterySymbolElement.imageSize = new Size(40, 40)
  const chargingIcon = getChargingIcon(isCharging, isPluggedIn, true)
  if (chargingIcon) {
    const chargingElement = batteryPercentStack.addImage(await getTintedIconAsync(chargingIcon))
    chargingElement.imageSize = new Size(25, 25)
  }

  batteryPercentStack.addSpacer(5)

  const batteryPercentText = batteryPercentStack.addText(`${batteryPercent.toString()}%`)
  batteryPercentText.textColor = getBatteryPercentColor(status.status.soc)
  batteryPercentText.font = Font.mediumSystemFont(20)

  if (isCharging) {
    const chargeComplete = getChargeCompletionString(lastSeen, remainingChargingTime)
    const batteryChargingTimeStack = mainStack.addStack()
    batteryChargingTimeStack.layoutHorizontally()
    batteryChargingTimeStack.addSpacer()
    // batteryChargingTimeStack.addSpacer()

    const chargingSpeedElement = batteryChargingTimeStack.addText(`${chargingKw}`)
    chargingSpeedElement.font = Font.mediumSystemFont(14)
    chargingSpeedElement.textOpacity = 0.9
    chargingSpeedElement.textColor = DARK_MODE ? Color.white() : Color.black()
    chargingSpeedElement.rightAlignText()
    batteryChargingTimeStack.addSpacer(3)

    const chargingTimeIconElement = batteryChargingTimeStack.addImage(
      await getTintedIconAsync('charging-complete-widget'),
    )
    chargingTimeIconElement.imageSize = new Size(15, 15)
    batteryChargingTimeStack.addSpacer(3)

    const chargingTimeElement = batteryChargingTimeStack.addText(`${chargeComplete}`)
    chargingTimeElement.font = Font.mediumSystemFont(14)
    chargingTimeElement.textOpacity = 0.9
    chargingTimeElement.textColor = DARK_MODE ? Color.white() : Color.black()
    chargingTimeElement.rightAlignText()
  }
  mainStack.addSpacer()

  // Footer
  const footerStack = mainStack.addStack()
  footerStack.addSpacer(10)

  // Add odometer
  const odometerText = `${Math.floor(Number(odometer)).toString()} ${bl.getDistanceUnit()}`
  const odometerElement = footerStack.addText(odometerText)
  odometerElement.font = Font.mediumSystemFont(12)
  odometerElement.textColor = DARK_MODE ? Color.white() : Color.black()
  odometerElement.textOpacity = 0.6
  odometerElement.minimumScaleFactor = 0.5
  odometerElement.leftAlignText()
  footerStack.addSpacer()

  // Add last seen indicator
  const lastSeenElement = footerStack.addText(
    'Last Updated: ' + lastSeen.toLocaleString(undefined, dateStringOptions) || 'unknown',
  )
  lastSeenElement.font = Font.mediumSystemFont(12)
  lastSeenElement.textOpacity = 0.6
  lastSeenElement.textColor = DARK_MODE ? Color.white() : Color.black()
  lastSeenElement.minimumScaleFactor = 0.5
  lastSeenElement.rightAlignText()

  mainStack.addSpacer()

  return widget
}

export async function createSmallWidget(config: Config, bl: Bluelink) {
  const refresh = await refreshDataForWidgetWithTimeout(bl, config)
  const status = refresh.status

  // Prepare image
  const appIcon = await bl.getCarImage(config.carColor)
  // define widget and set date for when the next refresh should not occur before.
  const widget = new ListWidget()
  widget.setPadding(20, 10, 15, 15)
  widget.refreshAfterDate = refresh.nextRefresh

  const mainStack = widget.addStack()
  mainStack.layoutVertically()
  // mainStack.addSpacer()

  // Add background color
  widget.backgroundColor = DARK_MODE ? new Color(DARK_BG_COLOR) : new Color(LIGHT_BG_COLOR)

  // Show app icon and title
  const titleStack = mainStack.addStack()
  const appIconElement = titleStack.addImage(appIcon)
  appIconElement.imageSize = new Size(90, 90 / (appIcon.size.width / appIcon.size.height))
  // appIconElement.cornerRadius = 4

  // space
  if (!status.status.isCharging) mainStack.addSpacer()

  // Battery Info
  const batteryInfoStack = mainStack.addStack()
  batteryInfoStack.layoutVertically()
  batteryInfoStack.addSpacer()

  // Range
  const rangeStack = batteryInfoStack.addStack()
  rangeStack.addSpacer()
  const rangeText = `${status.status.range} ${bl.getDistanceUnit()}`
  const rangeElement = rangeStack.addText(rangeText)
  rangeElement.font = Font.mediumSystemFont(20)
  rangeElement.textColor = DARK_MODE ? Color.white() : Color.black()
  rangeElement.rightAlignText()
  // batteryInfoStack.addSpacer()

  // set status from BL status response
  const isCharging = status.status.isCharging
  const isPluggedIn = status.status.isPluggedIn
  const batteryPercent = status.status.soc
  const remainingChargingTime = status.status.remainingChargeTimeMins
  const chargingKw = getChargingPowerString(status.status.chargingPower)
  const lastSeen = new Date(status.status.lastRemoteStatusCheck)

  // Battery Percent Value
  const batteryPercentStack = batteryInfoStack.addStack()
  batteryPercentStack.addSpacer()
  batteryPercentStack.centerAlignContent()
  const image = await getTintedIconAsync(calculateBatteryIcon(batteryPercent))
  const batterySymbolElement = batteryPercentStack.addImage(image)
  batterySymbolElement.imageSize = new Size(40, 40)
  const chargingIcon = getChargingIcon(isCharging, isPluggedIn, true)
  if (chargingIcon) {
    const chargingElement = batteryPercentStack.addImage(await getTintedIconAsync(chargingIcon))
    chargingElement.imageSize = new Size(25, 25)
  }

  // batteryPercentStack.addSpacer(5)

  const batteryPercentText = batteryPercentStack.addText(`${batteryPercent.toString()}%`)
  batteryPercentText.textColor = getBatteryPercentColor(status.status.soc)
  batteryPercentText.font = Font.mediumSystemFont(20)

  if (isCharging) {
    const chargeComplete = getChargeCompletionString(lastSeen, remainingChargingTime, 'short', true)
    const batteryChargingTimeStack = mainStack.addStack()
    batteryChargingTimeStack.layoutHorizontally()
    // batteryChargingTimeStack.addSpacer()
    batteryChargingTimeStack.addSpacer()

    const chargingSpeedElement = batteryChargingTimeStack.addText(`${chargingKw}`)
    chargingSpeedElement.font = Font.mediumSystemFont(13)
    chargingSpeedElement.textOpacity = 0.9
    chargingSpeedElement.textColor = DARK_MODE ? Color.white() : Color.black()
    chargingSpeedElement.leftAlignText()
    batteryChargingTimeStack.addSpacer(3)

    const chargingTimeIconElement = batteryChargingTimeStack.addImage(
      await getTintedIconAsync('charging-complete-widget'),
    )
    chargingTimeIconElement.imageSize = new Size(15, 15)
    batteryChargingTimeStack.addSpacer(3)

    const chargingTimeElement = batteryChargingTimeStack.addText(`${chargeComplete}`)
    chargingTimeElement.font = Font.mediumSystemFont(12)
    chargingTimeElement.textOpacity = 0.9
    chargingTimeElement.textColor = DARK_MODE ? Color.white() : Color.black()
    chargingTimeElement.rightAlignText()
  }
  mainStack.addSpacer()

  // Footer
  const footerStack = mainStack.addStack()
  footerStack.addSpacer() // hack - dynamic spacing doesnt seem to work that well here

  // Add last seen indicator - use consistent date format as spacing is hard coded, hence we need to control the length
  const lastSeenElement = footerStack.addText(lastSeen.toLocaleString(undefined, dateStringOptions) || 'unknown')
  lastSeenElement.lineLimit = 1
  lastSeenElement.font = Font.lightSystemFont(11)
  lastSeenElement.textOpacity = 0.6
  lastSeenElement.textColor = DARK_MODE ? Color.white() : Color.black()

  // mainStack.addSpacer()

  return widget
}

export async function createHomeScreenCircleWidget(config: Config, bl: Bluelink) {
  const refresh = await refreshDataForWidgetWithTimeout(bl, config)
  const status = refresh.status

  const widget = new ListWidget()
  widget.refreshAfterDate = refresh.nextRefresh

  const progressStack = await progressCircle(widget, status.status.soc)
  const mainIcon = status.status.isCharging ? SFSymbol.named('bolt.car') : SFSymbol.named('car.fill')
  const wmainIcon = progressStack.addImage(mainIcon.image)
  wmainIcon.imageSize = new Size(36, 36)
  wmainIcon.tintColor = new Color('#ffffff')

  return widget
}

export async function createHomeScreenRectangleWidget(config: Config, bl: Bluelink) {
  const refresh = await refreshDataForWidgetWithTimeout(bl, config)
  const status = refresh.status

  const widget = new ListWidget()
  widget.refreshAfterDate = refresh.nextRefresh

  const widgetStack = widget.addStack()
  // widgetStack.addSpacer(5)
  widgetStack.layoutVertically()
  const mainStack = widgetStack.addStack()

  const iconStack = await progressCircle(mainStack, status.status.soc)
  const mainIcon = status.status.isCharging ? SFSymbol.named('bolt.car') : SFSymbol.named('car.fill')
  const wmainIcon = iconStack.addImage(mainIcon.image)
  wmainIcon.imageSize = new Size(36, 36)
  wmainIcon.tintColor = new Color('#ffffff')

  // Battery Info
  const batteryInfoStack = mainStack.addStack()
  batteryInfoStack.layoutVertically()
  batteryInfoStack.addSpacer(5)

  // Range
  const rangeStack = batteryInfoStack.addStack()
  rangeStack.addSpacer()
  const rangeText = `${status.status.range} ${bl.getDistanceUnit()}`
  const rangeElement = rangeStack.addText(rangeText)
  rangeElement.font = Font.boldSystemFont(15)
  rangeElement.textColor = Color.white()
  rangeElement.rightAlignText()

  // set status from BL status response
  const isCharging = status.status.isCharging
  const isPluggedIn = status.status.isPluggedIn
  const batteryPercent = status.status.soc
  const remainingChargingTime = status.status.remainingChargeTimeMins
  const lastSeen = new Date(status.status.lastRemoteStatusCheck)

  // Battery Percent Value
  const batteryPercentStack = batteryInfoStack.addStack()
  batteryPercentStack.centerAlignContent()
  batteryPercentStack.addSpacer()
  const chargingIcon = getChargingIcon(isCharging, isPluggedIn, true)
  if (chargingIcon) {
    const chargingElement = batteryPercentStack.addImage(await getTintedIconAsync(chargingIcon))
    chargingElement.tintColor = new Color('#ffffff')
    chargingElement.imageSize = new Size(15, 15)
    chargingElement.rightAlignImage()
  }

  batteryPercentStack.addSpacer(3)
  const batteryPercentText = batteryPercentStack.addText(`${batteryPercent.toString()}%`)
  batteryPercentText.textColor = getBatteryPercentColor(status.status.soc)
  batteryPercentText.font = Font.boldSystemFont(15)

  if (isCharging) {
    const chargeComplete = getChargeCompletionString(lastSeen, remainingChargingTime, 'short', true)
    const batteryChargingTimeStack = batteryInfoStack.addStack()

    // bug in dynamic spacing means we only set spacing if string is less than 10 characters
    if (chargeComplete.length < 10) {
      batteryChargingTimeStack.addSpacer()
    }

    const chargingTimeIconElement = batteryChargingTimeStack.addImage(SFSymbol.named('clock.fill').image)
    chargingTimeIconElement.tintColor = new Color('#ffffff')
    chargingTimeIconElement.imageSize = new Size(14, 14)
    batteryChargingTimeStack.addSpacer(3)

    const chargingTimeElement = batteryChargingTimeStack.addText(`${chargeComplete}`)
    chargingTimeElement.font = Font.mediumMonospacedSystemFont(12)
    chargingTimeElement.textOpacity = 0.9
    chargingTimeElement.textColor = Color.white()
    chargingTimeElement.rightAlignText()
  }

  return widget
}

async function progressCircle(
  on: ListWidget | WidgetStack,
  value = 50,
  colour = 'hsl(0, 0%, 100%)',
  background = 'hsl(0, 0%, 10%)',
  size = 60,
  barWidth = 5,
) {
  if (value > 1) {
    value /= 100
  }
  if (value < 0) {
    value = 0
  }
  if (value > 1) {
    value = 1
  }

  const w = new WebView()
  await w.loadHTML('<canvas id="c"></canvas>')

  const base64 = await w.evaluateJavaScript(
    `
  let colour = "${colour}",
    background = "${background}",
    size = ${size}*3,
    lineWidth = ${barWidth}*3,
    percent = ${value * 100}
      
  let canvas = document.getElementById('c'),
    c = canvas.getContext('2d')
  canvas.width = size
  canvas.height = size
  let posX = canvas.width / 2,
    posY = canvas.height / 2,
    onePercent = 360 / 100,
    result = onePercent * percent
  c.lineCap = 'round'
  c.beginPath()
  c.arc( posX, posY, (size-lineWidth-1)/2, (Math.PI/180) * 270, (Math.PI/180) * (270 + 360) )
  c.strokeStyle = background
  c.lineWidth = lineWidth 
  c.stroke()
  c.beginPath()
  c.strokeStyle = colour
  c.lineWidth = lineWidth
  c.arc( posX, posY, (size-lineWidth-1)/2, (Math.PI/180) * 270, (Math.PI/180) * (270 + result) )
  c.stroke()
  completion(canvas.toDataURL().replace("data:image/png;base64,",""))`,
    true,
  )
  const image = Image.fromData(Data.fromBase64String(base64))

  const stack = on.addStack()
  stack.size = new Size(size, size)
  stack.backgroundImage = image
  stack.centerAlignContent()
  const padding = barWidth * 2
  stack.setPadding(padding, padding, padding, padding)

  return stack
}
