import { getConfig, ScreenHeightMeasurements } from './configRegister'
import { notifyNow } from './notifications'

/** Using `Device.isInPortrait`, and similar predicates, is very inconsistent.
 * The main symptom of this is that when the device is flat on a surface, all
 * the orientation predicates are false (it's not in portrait nor landscape).
 * This solution should be pretty bullet-proof */
export const getDeviceOrientation = (): ScreenHeightMeasurements.Orientation => {
  const width = Device.screenSize().width
  const height = Device.screenSize().height
  return width > height ? 'landscape' : 'portrait'
}

export const getMaxScreenHeight = (mode: ScreenHeightMeasurements.Mode) => {
  const device = Device.model()
  const deviceSettings = getConfig('SCREEN_HEIGHT_MEASUREMENTS')[device]
  if (!deviceSettings) {
    notifyNow(`No screen height settings for ${device}`)
    return Device.screenSize().height
  }
  return deviceSettings[mode][getDeviceOrientation()]
}
