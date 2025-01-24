import { Bluelink } from './bluelink-regions/base'
import { Config } from 'config'
import { BluelinkCanada } from './bluelink-regions/canada'

export async function initRegionalBluelink(config: Config): Promise<BluelinkCanada | Bluelink> {
  switch (config.auth.region) {
    case 'canada':
      return await BluelinkCanada.init(config)
    default:
      throw Error(`Region ${config.auth.region} not supported`)
  }
}
