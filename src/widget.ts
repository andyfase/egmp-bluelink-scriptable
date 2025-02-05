import {
  getTintedIconAsync,
  getBatteryPercentColor,
  calculateBatteryIcon,
  getChargingIcon,
  dateStringOptions,
  getChargeCompletionString,
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

// Day Intervals - day lasts for 16 days - in milliseconds
const DEFAULT_STATUS_CHECK_INTERVAL_DAY = 3600 * 1000
const DEFAULT_REMOTE_REFRESH_INTERVAL_DAY = 3600 * 4 * 1000 // max 4 remote refreshes per day
const DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL_DAY = 3600 * 2 * 1000 // max 8 remote refreshes per day

// Night Intervals - night lasts for 8 hours - in milliseconds
const DEFAULT_STATUS_CHECK_INTERVAL_NIGHT = 3600 * 2 * 1000
const DEFAULT_REMOTE_REFRESH_INTERVAL_NIGHT = 3600 * 6 * 1000 // max 1 remote refresh per night
const DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL_NIGHT = 3600 * 4 * 1000 // max 2 remote refreshes per night

const WIDGET_LOG_FILE = 'egmp-bluelink-widget.log'

interface WidgetRefreshCache {
  lastRemoteRefresh: number
}

const DEFAULT_WIDGET_CACHE = {
  lastRemoteRefresh: 0,
} as WidgetRefreshCache

interface WidgetRefresh {
  nextRefresh: Date
  status: Status
}

export function deleteWidgetCache() {
  Keychain.remove(KEYCHAIN_WIDGET_REFRESH_KEY)
}

async function refreshDataForWidget(bl: Bluelink, config: Config): Promise<WidgetRefresh> {
  const logger = new Logger(WIDGET_LOG_FILE, 100)
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

  if (Keychain.contains(KEYCHAIN_WIDGET_REFRESH_KEY)) {
    cache = {
      ...DEFAULT_WIDGET_CACHE,
      ...JSON.parse(Keychain.get(KEYCHAIN_WIDGET_REFRESH_KEY)),
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
  const chargingAndOverRemoteRefreshInterval =
    status.status.isCharging && lastRemoteCheck + DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL < currentTimestamp

  const notChargingAndOverRemoteRefreshInterval =
    !status.status.isCharging && lastRemoteCheck + DEFAULT_REMOTE_REFRESH_INTERVAL < currentTimestamp

  // calculate next remote check - reset if calculated value is in the past
  const remoteRefreshInterval = status.status.isCharging
    ? DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL
    : DEFAULT_REMOTE_REFRESH_INTERVAL
  let nextRemoteRefreshTime = lastRemoteCheck + remoteRefreshInterval
  if (nextRemoteRefreshTime < currentTimestamp) nextRemoteRefreshTime = currentTimestamp + remoteRefreshInterval

  // nextAPIRefreshTime is always based on DEFAULT_STATUS_CHECK_INTERVAL as its the default option
  const nextAPIRefreshTime = currentTimestamp + DEFAULT_STATUS_CHECK_INTERVAL

  // choose the lowest of the two values.
  const lowestRefreshTime = nextAPIRefreshTime < nextRemoteRefreshTime ? nextAPIRefreshTime : nextRemoteRefreshTime
  let nextRefresh = new Date(lowestRefreshTime)

  try {
    if (
      config.allowWidgetRemoteRefresh &&
      (chargingAndOverRemoteRefreshInterval || notChargingAndOverRemoteRefreshInterval)
    ) {
      // Note a remote refresh takes to long to wait for - so trigger it and set a small nextRefresh value to pick
      // up the remote data on the next widget refresh
      if (config.debugLogging) logger.log('Doing Force Refresh')
      bl.getStatus(true, true) // no await deliberatly
      sleep(500) // wait for API request to be actually sent in background
      cache.lastRemoteRefresh = currentTimestamp
      nextRefresh = new Date(Date.now() + 5 * 60 * 1000)
    } else {
      if (config.debugLogging) logger.log('Doing API Refresh')
      status = await bl.getStatus(false, true)
    }
  } catch (_error) {
    // ignore any API errors and just displayed last cached values in widget
    // we have no guarentee of network connection
  }

  Keychain.set(KEYCHAIN_WIDGET_REFRESH_KEY, JSON.stringify(cache))
  if (config.debugLogging)
    logger.log(
      `Current time: ${new Date().toLocaleString()}. Last Remote refresh: last refresh ${new Date(status.status.lastRemoteStatusCheck).toLocaleString()} Setting next refresh to ${nextRefresh.toLocaleString()}`,
    )

  return {
    nextRefresh: nextRefresh,
    status: status,
  }
}

export async function createWidget(config: Config, bl: Bluelink) {
  const refresh = await refreshDataForWidget(bl, config)
  const status = refresh.status

  // Prepare image
  const appIcon = await bl.getCarImage()
  const title = status.car.nickName || `${status.car.modelYear} ${status.car.modelName}`

  // define widget and set date for when the next refresh should not occur before.
  const widget = new ListWidget()
  widget.refreshAfterDate = refresh.nextRefresh

  const mainStack = widget.addStack()
  mainStack.layoutVertically()

  // Add background color
  widget.backgroundColor = DARK_MODE ? new Color(DARK_BG_COLOR) : new Color(LIGHT_BG_COLOR)

  // Show app icon and title
  mainStack.addSpacer()
  const titleStack = mainStack.addStack()
  const titleElement = titleStack.addText(title)
  titleElement.textColor = DARK_MODE ? Color.white() : Color.black()
  titleElement.textOpacity = 0.7
  titleElement.font = Font.mediumSystemFont(25)
  titleStack.addSpacer()
  const appIconElement = titleStack.addImage(appIcon)
  appIconElement.imageSize = new Size(30, 30)
  appIconElement.cornerRadius = 4
  mainStack.addSpacer()

  // Center Stack
  const contentStack = mainStack.addStack()
  const carImageElement = contentStack.addImage(appIcon)
  carImageElement.imageSize = new Size(170, 70)
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
  const chargingKw = status.status.chargingPower.toString()
  const odometer = status.status.odometer
  const lastSeen = new Date(status.status.lastRemoteStatusCheck)

  // Battery Percent Value
  const batteryPercentStack = batteryInfoStack.addStack()
  batteryPercentStack.addSpacer()
  batteryPercentStack.centerAlignContent()
  const image = await getTintedIconAsync(calculateBatteryIcon(batteryPercent))
  const batterySymbolElement = batteryPercentStack.addImage(image)
  batterySymbolElement.imageSize = new Size(40, 40)
  const chargingIcon = getChargingIcon(isCharging, isPluggedIn)
  if (chargingIcon) {
    const chargingElement = batteryPercentStack.addImage(await getTintedIconAsync(chargingIcon))
    chargingElement.imageSize = new Size(25, 25)
  }

  batteryPercentStack.addSpacer(5)

  const batteryPercentText = batteryPercentStack.addText(`${batteryPercent.toString()}%`)
  batteryPercentText.textColor = getBatteryPercentColor(50)
  batteryPercentText.font = Font.mediumSystemFont(20)

  if (isCharging) {
    const chargeComplete = getChargeCompletionString(lastSeen, remainingChargingTime)
    const batteryChargingTimeStack = mainStack.addStack()
    batteryChargingTimeStack.layoutHorizontally()
    batteryChargingTimeStack.addSpacer()
    // batteryChargingTimeStack.addSpacer()

    const chargingSpeedElement = batteryChargingTimeStack.addText(`${chargingKw} kW`)
    chargingSpeedElement.font = Font.mediumSystemFont(14)
    chargingSpeedElement.textOpacity = 0.9
    chargingSpeedElement.textColor = DARK_MODE ? Color.white() : Color.black()
    chargingSpeedElement.rightAlignText()
    batteryChargingTimeStack.addSpacer(3)

    const chargingTimeIconElement = batteryChargingTimeStack.addImage(await getTintedIconAsync('charging-complete'))
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

  // Add odometer
  const odometerText = `${Math.floor(Number(odometer)).toString()} ${bl.getDistanceUnit()}`
  const odometerElement = footerStack.addText(odometerText)
  odometerElement.font = Font.mediumSystemFont(12)
  odometerElement.textColor = DARK_MODE ? Color.white() : Color.black()
  odometerElement.textOpacity = 0.5
  odometerElement.minimumScaleFactor = 0.5
  odometerElement.leftAlignText()
  footerStack.addSpacer()

  // Add last seen indicator
  const lastSeenElement = footerStack.addText(
    'Last Updated: ' + lastSeen.toLocaleString(undefined, dateStringOptions) || 'unknown',
  )
  lastSeenElement.font = Font.mediumSystemFont(12)
  lastSeenElement.textOpacity = 0.5
  lastSeenElement.textColor = DARK_MODE ? Color.white() : Color.black()
  lastSeenElement.minimumScaleFactor = 0.5
  lastSeenElement.rightAlignText()

  mainStack.addSpacer()

  return widget
}
