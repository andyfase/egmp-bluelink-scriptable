import { Bluelink } from './bluelink-regions/base'
import { Config } from 'config'
import { BluelinkCanada } from './bluelink-regions/canada'
import { BluelinkUSA } from './bluelink-regions/usa'
import { BluelinkUSAKia } from './bluelink-regions/usa-kia'
import { BluelinkEurope } from './bluelink-regions/europe'
import { BluelinkIndia } from './bluelink-regions/india'
import { BluelinkAustralia } from './bluelink-regions/australia'

const regionSupport = {
  kia: ['canada', 'usa', 'europe', 'australia'],
  hyundai: ['canada', 'usa', 'europe', 'india', 'australia'],
  genesis: ['canada', 'usa'],
}

export async function initRegionalBluelink(
  config: Config,
  refreshAuth = true,
): Promise<BluelinkCanada | Bluelink | undefined> {
  for (const [manufacturer, regions] of Object.entries(regionSupport)) {
    if (config.manufacturer.toLowerCase() === manufacturer) {
      if (!regions.includes(config.auth.region)) {
        throw new Error(`${config.manufacturer} is not supported in this region`)
      }
    }
  }

  switch (config.auth.region) {
    case 'canada':
      return await BluelinkCanada.init(config, refreshAuth)
    case 'usa':
      return config.manufacturer === 'kia'
        ? await BluelinkUSAKia.init(config, refreshAuth)
        : await BluelinkUSA.init(config, refreshAuth)
    case 'europe':
      return await BluelinkEurope.init(config, refreshAuth)
    case 'india':
      return await BluelinkIndia.init(config, refreshAuth)
    case 'australia':
      return await BluelinkAustralia.init(config, refreshAuth)
    default:
      throw new Error(
        `Something went wrong determining bluelink region! Please raise an issue on GitHub with details of your vehicle and region.`,
      )
  }
}
