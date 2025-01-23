import {
  getTintedIconAsync,
  getBatteryPercentColor,
  calculateBatteryIcon,
  getChargingIcon,
  dateStringOptions,
  getChargeCompletionString,
} from './lib/util'
import { initRegionalBluelink } from './lib/bluelink'
import { BluelinkCreds, Bluelink, Status } from './lib/bluelink-regions/base'

// Widget Config
const RANGE_IN_MILES = false // true

const DARK_MODE = true // Device.isUsingDarkAppearance(); // or set manually to (true or false)
const DARK_BG_COLOR = '000000'
const LIGHT_BG_COLOR = 'FFFFFF'

const KEYCHAIN_WIDGET_REFRESH_KEY = 'bluelink-widget-refresh'
const DEFAULT_STATUS_CHECK_INTERVAL_DAY = 3600
const DEFAULT_STATUS_CHECK_INTERVAL_NIGHT = 10800
const DEFAULT_CHARGING_FORCE_REFRESH_INTERVAL = 7200
const NIGHT_HOUR_START = 23
const NIGHT_HOUR_STOP = 7

interface WidgetRefreshCache {
  lastCacheRefresh: number
  lastNormalRefresh: number
  lastForceRefresh: number
  normalRefreshRequired: boolean
}

async function refreshDataForWidget(bl: Bluelink): Promise<{ status: Status; debug: string }> {
  let cache: WidgetRefreshCache | undefined = undefined
  const currentTimestamp = Math.floor(Date.now() / 1000)
  const currentHour = new Date().getHours()
  const DEFAULT_STATUS_CHECK_INTERVAL =
    currentHour < NIGHT_HOUR_START && currentHour > NIGHT_HOUR_STOP
      ? DEFAULT_STATUS_CHECK_INTERVAL_DAY
      : DEFAULT_STATUS_CHECK_INTERVAL_NIGHT

  if (Keychain.contains(KEYCHAIN_WIDGET_REFRESH_KEY)) {
    cache = JSON.parse(Keychain.get(KEYCHAIN_WIDGET_REFRESH_KEY))
  }
  if (!cache) {
    cache = {
      lastCacheRefresh: 0,
      lastNormalRefresh: 0,
      lastForceRefresh: 0,
      normalRefreshRequired: false,
    }
  }
  let status = bl.getCachedStatus()
  cache.lastCacheRefresh = currentTimestamp

  let debugMessage = 'cache'
  // LOGIC for refresh within widget
  // 1. If charging OR charger plugged in do a forceRefresh (poll car) every DEFAULT_CHARGING_FORCE_REFRESH_INTERVAL period
  //    Note we do not block for the response of this call - we just init it, get the normal API status,
  //    and set normalRefreshRequired to true - to ensure remote data is fetched on next widget refresh (normally ~15 mins)
  // 2. If NOT charing perform a normal (non car polling) refresh based on time of day (localtime) using DEFAULT_STATUS_CHECK_INTERVAL_DAY or DEFAULT_STATUS_CHECK_INTERVAL_NIGHT
  // 3. Otherwise accept whatever was from the getCachedStatus call

  if (
    status.status.isCharging ||
    (status.status.isPluggedIn && cache.lastForceRefresh + DEFAULT_CHARGING_FORCE_REFRESH_INTERVAL < currentTimestamp)
  ) {
    debugMessage = 'force'
    status = await bl.getStatus(false, true)
    bl.getStatus(true, true) // no await deliberatly
    cache.lastForceRefresh = currentTimestamp
    cache.normalRefreshRequired = true
  } else if (
    cache.normalRefreshRequired ||
    cache.lastNormalRefresh + DEFAULT_STATUS_CHECK_INTERVAL < currentTimestamp
  ) {
    debugMessage = 'normal'
    status = await bl.getStatus(false, true)
    cache.lastNormalRefresh = currentTimestamp
    cache.normalRefreshRequired = false
  }

  Keychain.set(KEYCHAIN_WIDGET_REFRESH_KEY, JSON.stringify(cache))
  return { status: status, debug: debugMessage }
}

export async function createWidget(creds: BluelinkCreds) {
  const bl = await initRegionalBluelink(creds)
  const refresh = await refreshDataForWidget(bl)
  const status = refresh.status

  // Prepare image
  const appIcon = Image.fromData(Data.fromBase64String(bl.getCarImage()))
  const title = status.car.nickName + ` ${refresh.debug}` || `${status.car.modelYear} ${status.car.modelName}`

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
  // mainStack.addSpacer()

  // Center Stack
  const contentStack = mainStack.addStack()
  const carImageElement = contentStack.addImage(appIcon)
  carImageElement.imageSize = new Size(130, 90)
  contentStack.addSpacer()

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
    const batteryChargingTimeStack = batteryInfoStack.addStack()
    batteryChargingTimeStack.addSpacer()

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
  batteryInfoStack.addSpacer()

  // Footer
  const footerStack = mainStack.addStack()

  // Add odometer
  const odometerText = RANGE_IN_MILES
    ? `${Math.floor(Number(odometer / 1.6)).toString()} mi`
    : `${Math.floor(Number(odometer)).toString()} km`
  const odometerElement = footerStack.addText(odometerText)
  odometerElement.font = Font.mediumSystemFont(10)
  odometerElement.textColor = DARK_MODE ? Color.white() : Color.black()
  odometerElement.textOpacity = 0.5
  odometerElement.minimumScaleFactor = 0.5
  odometerElement.leftAlignText()
  footerStack.addSpacer()

  // Add last seen indicator
  const lastSeenElement = footerStack.addText(
    'Last Updated: ' + lastSeen.toLocaleString(undefined, dateStringOptions) || 'unknown',
  )
  lastSeenElement.font = Font.mediumSystemFont(10)
  lastSeenElement.textOpacity = 0.5
  lastSeenElement.textColor = DARK_MODE ? Color.white() : Color.black()
  lastSeenElement.minimumScaleFactor = 0.5
  lastSeenElement.rightAlignText()

  mainStack.addSpacer()

  return widget
}
