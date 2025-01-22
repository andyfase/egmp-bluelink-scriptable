import { creds } from "../index"
import { Bluelink } from "./bluelink-regions/base"
import { BluelinkCanada } from "./bluelink-regions/canada"

export async function initRegionalBluelink(creds: creds) : Promise<BluelinkCanada | Bluelink> {
    switch(creds.region) {
      case "canada":
        return await BluelinkCanada.init(creds) 
      default:
        throw Error(`Region ${creds.region} not supported`)
    }
  } 