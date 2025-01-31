import { Bluelink } from './bluelink-regions/base'
import { Config } from 'config'
import { BluelinkCanada } from './bluelink-regions/canada'
import { BluelinkUSA } from './bluelink-regions/usa'

export async function initRegionalBluelink(config: Config): Promise<BluelinkCanada | Bluelink | undefined> {
  switch (config.auth.region) {
    case 'canada':
      return await BluelinkCanada.init(config)
    case 'usa':
      return await BluelinkUSA.init(config)
    default:
      return
  }
}
