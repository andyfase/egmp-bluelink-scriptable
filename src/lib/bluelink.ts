import { Bluelink } from './bluelink-regions/base'
import { Config } from 'config'
import { BluelinkCanada } from './bluelink-regions/canada'
import { BluelinkUSA } from './bluelink-regions/usa'
import { BluelinkUSAKia } from './bluelink-regions/usa-kia'
import { BluelinkEurope } from './bluelink-regions/europe'
import { BluelinkIndia } from './bluelink-regions/india'
import { BluelinkAustralia } from './bluelink-regions/australia'

export async function initRegionalBluelink(config: Config): Promise<BluelinkCanada | Bluelink | undefined> {
  switch (config.auth.region) {
    case 'canada':
      return await BluelinkCanada.init(config)
    case 'usa':
      return config.manufacturer === 'hyundai' ? await BluelinkUSA.init(config) : await BluelinkUSAKia.init(config)
    case 'europe':
      return await BluelinkEurope.init(config)
    case 'india':
      return await BluelinkIndia.init(config)
    case 'australia':
      return await BluelinkAustralia.init(config)
    default:
      return
  }
}
