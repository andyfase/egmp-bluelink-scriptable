import { Bluelink, BluelinkCreds } from './bluelink-regions/base'
import { BluelinkCanada } from './bluelink-regions/canada'

export async function initRegionalBluelink(creds: BluelinkCreds): Promise<BluelinkCanada | Bluelink> {
  switch (creds.region) {
    case 'canada':
      return await BluelinkCanada.init(creds)
    default:
      throw Error(`Region ${creds.region} not supported`)
  }
}
