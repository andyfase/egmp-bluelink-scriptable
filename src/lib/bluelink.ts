import { Bluelink } from './bluelink-regions/base'
import { Config } from 'config'
import { BluelinkCanada } from './bluelink-regions/canada'
import { BluelinkUSA } from './bluelink-regions/usa'
import { BluelinkUSAKia } from './bluelink-regions/usa-kia'
import { BluelinkEurope } from './bluelink-regions/europe'
import { BluelinkIndia } from './bluelink-regions/india'
import { BluelinkAustralia } from './bluelink-regions/australia'
import { BluelinkSingapore } from './bluelink-regions/singapore'

const regionSupport = {
  kia: ['canada', 'usa', 'europe', 'australia'],
  hyundai: ['canada', 'usa', 'europe', 'india', 'australia', 'singapore'],
  genesis: ['canada', 'usa'],
}

export async function initRegionalBluelink(
  config: Config,
  refreshAuth = true,
): Promise<BluelinkCanada | Bluelink | undefined> {
  // Manufacturer is stored as displayed (e.g. "Hyundai"), but the region clients
  // use a lowercase convention internally (API_CONFIG keys, `=== 'kia'` checks).
  // Normalize once here so casing never matters downstream.
  const normalizedConfig: Config = {
    ...config,
    manufacturer: config.manufacturer.toLowerCase(),
  }

  for (const [manufacturer, regions] of Object.entries(regionSupport)) {
    if (normalizedConfig.manufacturer === manufacturer) {
      if (!regions.includes(normalizedConfig.auth.region)) {
        throw new Error(`${config.manufacturer} is not supported in this region`)
      }
    }
  }

  switch (normalizedConfig.auth.region) {
    case 'canada':
      return await BluelinkCanada.init(normalizedConfig, refreshAuth)
    case 'usa':
      return normalizedConfig.manufacturer === 'kia'
        ? await BluelinkUSAKia.init(normalizedConfig, refreshAuth)
        : await BluelinkUSA.init(normalizedConfig, refreshAuth)
    case 'europe':
      return await BluelinkEurope.init(normalizedConfig, refreshAuth)
    case 'india':
      return await BluelinkIndia.init(normalizedConfig, refreshAuth)
    case 'australia':
      return await BluelinkAustralia.init(normalizedConfig, refreshAuth)
    case 'singapore':
      return await BluelinkSingapore.init(normalizedConfig, refreshAuth)
    default:
      throw new Error(
        `Something went wrong determining bluelink region! Please raise an issue on GitHub with details of your vehicle and region.`,
      )
  }
}
