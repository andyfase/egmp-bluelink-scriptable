import {
  getTintedIconAsync,
  getBatteryPercentColor,
  calculateBatteryIcon,
  getChargingIcon,
  dateStringOptions,
  getChargeCompletionString,
  sleep,
} from './lib/util'
import { initRegionalBluelink } from './lib/bluelink'
import { Bluelink, Status } from './lib/bluelink-regions/base'
import { Config } from 'config'
import PersistedLog from './lib/scriptable-utils/io/PersistedLog'

// Widget Config
const RANGE_IN_MILES = false // true

const DARK_MODE = true // Device.isUsingDarkAppearance(); // or set manually to (true or false)
const DARK_BG_COLOR = '000000'
const LIGHT_BG_COLOR = 'FFFFFF'

const KEYCHAIN_WIDGET_REFRESH_KEY = 'egmp-bluelink-widget'

// Definition of Day/Night Hours
const NIGHT_HOUR_START = 23
const NIGHT_HOUR_STOP = 7

// Day Intervals - day lasts for 16 days
const DEFAULT_STATUS_CHECK_INTERVAL_DAY = 3600
const DEFAULT_REMOTE_REFRESH_INTERVAL_DAY = 3600 * 4 // max 4 remote refreshes per day
const DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL_DAY = 3600 * 2 // max 8 remote refreshes per day

// Night Intervals - night lasts for 8 hours
const DEFAULT_STATUS_CHECK_INTERVAL_NIGHT = 3600 * 2
const DEFAULT_REMOTE_REFRESH_INTERVAL_NIGHT = 3600 * 6 // max 1 remote refresh per night
const DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL_NIGHT = 3600 * 4 // max 2 remote refreshes per night

const WIDGET_LOG_FILE = 'egmp-bluelink-widget-log'

interface WidgetRefreshCache {
  normalRefreshRequired: boolean
  lastRemoteRefresh: number
}

const DEFAULT_WIDGET_CACHE = {
  normalRefreshRequired: false,
  lastRemoteRefresh: 0,
}

async function refreshDataForWidget(bl: Bluelink, config: Config): Promise<Status> {
  const logger = PersistedLog(WIDGET_LOG_FILE)
  let cache: WidgetRefreshCache | undefined = undefined
  const currentTimestamp = Math.floor(Date.now() / 1000)
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
  const lastRemoteCheckString = status.status.lastRemoteStatusCheck + 'Z'
  const df = new DateFormatter()
  df.dateFormat = 'yyyyMMddHHmmssZ'
  let lastRemoteCheck = Math.floor(df.date(lastRemoteCheckString).getTime() / 1000)
  lastRemoteCheck = lastRemoteCheck > cache.lastRemoteRefresh ? lastRemoteCheck : cache.lastRemoteRefresh

  // LOGIC for refresh within widget
  // 1.Force refresh if user opted in via config AND last remote check is older than:
  //   - DEFAULT_REMOTE_REFRESH_INTERVAL if NOT charging
  //   - DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL if charging
  // 2. Normal refresh if:
  //   - normalRefreshRequired is set OR
  //   - last status check is older than DEFAULT_STATUS_CHECK_INTERVAL
  // 3. Use cached status if none of the above conditions are met
  //
  // The time intervals vary based on day/night - with day being more frequent
  const chargingAndOverRemoteRefreshInterval =
    status.status.isCharging && lastRemoteCheck + DEFAULT_CHARGING_REMOTE_REFRESH_INTERVAL < currentTimestamp

  const notChargingAndOverRemoteRefreshInterval =
    !status.status.isCharging && lastRemoteCheck + DEFAULT_REMOTE_REFRESH_INTERVAL < currentTimestamp

  const overNormalRefreshInterval = status.status.lastStatusCheck + DEFAULT_STATUS_CHECK_INTERVAL < currentTimestamp

  try {
    if (
      config.allowWidgetRemoteRefresh &&
      (chargingAndOverRemoteRefreshInterval || notChargingAndOverRemoteRefreshInterval)
    ) {
      if (config.debugLogging) await logger.log('Doing Force Refresh')
      bl.getStatus(true, true) // no await deliberatly
      sleep(500) // wait for API request to be actually sent in background
      cache.lastRemoteRefresh = currentTimestamp
      cache.normalRefreshRequired = true
    } else if (cache.normalRefreshRequired || overNormalRefreshInterval) {
      if (config.debugLogging) await logger.log('Doing API Refresh')
      status = await bl.getStatus(false, true)
      cache.normalRefreshRequired = false
    } else {
      if (config.debugLogging) await logger.log('Using Cached Status')
    }
  } catch (_error) {
    // ignore any API errors and just displayed last cached values in widget
    // we have no guarentee of network connection
  }

  Keychain.set(KEYCHAIN_WIDGET_REFRESH_KEY, JSON.stringify(cache))
  return status
}

export async function createWidget(config: Config) {
  const bl = await initRegionalBluelink(config)
  const status = await refreshDataForWidget(bl, config)

  // Prepare image
  const appIcon = Image.fromData(Data.fromBase64String(bl.getCarImage()))
  const title = status.car.nickName || `${status.car.modelYear} ${status.car.modelName}`

  const widget = new ListWidget()
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
  const rangeText = `${status.status.range}km`
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
  const updatedTime = status.status.lastRemoteStatusCheck + 'Z'

  // date conversion
  const df = new DateFormatter()
  df.dateFormat = 'yyyyMMddHHmmssZ'
  const lastSeen = df.date(updatedTime)

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
  const odometerText = RANGE_IN_MILES
    ? `${Math.floor(Number(odometer / 1.6)).toString()} mi`
    : `${Math.floor(Number(odometer)).toString()} km`
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
