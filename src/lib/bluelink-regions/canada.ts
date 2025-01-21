
// Turn Off Conditioning https://mybluelink.ca/tods/api/evc/rfoff
// payload {"pin":"XXXX"}

// status of last command https://mybluelink.ca/tods/api/rmtsts
// resp 

// "result": {
//         "transaction": {
//             "apiCode": "RMT-E0302",
//             "apiStartDate": "20250120234803",
//             "apiEndDate": "20250120234803",
//             "apiResult": "P", // "C" for complete "P" for processing
//             "apiStatusCode": "null"
//         }
//     }
// }


import { Bluelink, BluelinkCreds, BluelinkTokens, BluelinkCar, BluelinkStatus } from "../bluelink"

const API_DOMAIN = "https://mybluelink.ca/tods/api/"

export class BluelinkCanada extends Bluelink {

  constructor(creds: BluelinkCreds, vin?: string, statusCheckInterval?: number) {
    super(creds, vin, statusCheckInterval)
  }

  async init(creds: BluelinkCreds, vin?: string, statusCheckInterval?: number) {
    const obj = new BluelinkCanada(creds, vin, statusCheckInterval)
    await obj.superInit(creds, vin, statusCheckInterval)
    return obj
  } 

  private requestResponseValid(payload: any): boolean {
    if (payload.hasOwnProperty("responseHeader") && payload.responseHeader.responseCode == 0) {
      return true
    }
    return false
  }

  protected async login() : Promise<BluelinkTokens> {
    const resp = await this.request({
      url: API_DOMAIN + "v2/login", 
      data: JSON.stringify({
        loginId: this.creds.username,
        password: this.creds.password
      })
    })
    if (this.requestResponseValid(resp)) {
      return {
        accessToken: resp.result.token.accessToken,
        expiry: Math.floor(Date.now()/1000) + resp.result.token.expireIn // we only get a expireIn not a actual date
      }
    }
    throw Error(`Login Failed: ${JSON.stringify(resp)}`)
  }
  
  protected async setCar(id: string) {
    const resp = await this.request({
      url: API_DOMAIN + "vhcllst", 
      data: JSON.stringify({
        "vehicleId": id
      })
    })
    if (! this.requestResponseValid(resp)) {
      throw Error(`Failed to set car ${id}: ${resp}`)
    }
  }

  protected async getCar() : Promise<BluelinkCar> {
    const resp = await this.request({
      url: API_DOMAIN + "vhcllst", 
      method: "POST"
    })
    if (this.requestResponseValid(resp) && resp.result.vehicles.length > 0) {
      let vehicle = resp.result.vehicles[0]
      if (this.vin) {
        for (const v of resp.result.vehicles) {
          if (v.vin === this.vin) {
            vehicle = v
            break
          }
        }
      }
      // should set car just in case its not already set
      await this.setCar(vehicle.vehicleId)
      return {
        id: vehicle.vehicleId,
        vin: vehicle.vin,
        nickName: vehicle.nickName,
        modelName: vehicle.modelName,
        modelYear: vehicle.modelYear,
        modelColour: vehicle.exteriorColor,
        modelTrim: vehicle.trim,
        odometer: vehicle.odometer
      }
    }
    throw Error(`Failed to retrieve vehicle list: ${resp}`)
  }

  protected async getCarStatus(id: string, forceUpdate: boolean) : Promise<BluelinkStatus> {
    const api = forceUpdate ? "rltmvhclsts" : "sltvhcl"
    const resp = await this.request({
      url: API_DOMAIN + api, 
      method: "POST"
    })
    if (this.requestResponseValid(resp)) {
      return {
        lastStatusCheck: Math.floor(Date.now()/1000),
        lastRemoteStatusCheck: resp.result.status.lastStatusDate,
        isCharging: resp.result.status.evStatus.batteryCharge,
        chargingPower: resp.result.status.evStatus.batteryPower.batteryFstChrgPower > 0 ?
          resp.result.status.evStatus.batteryPower.batteryFstChrgPower : 
          resp.result.status.evStatus.batteryPower.batteryStndChrgPower,
        remainingChargeTimeMins: resp.result.status.evStatus.remainTime2.atc.value,
        range: resp.result.status.evStatus.drvDistance[0].evModeRange.value,
        locked: resp.result.status.doorLock,
        conditioning: resp.result.status.airCtrlOn,
        soc: resp.result.status.evStatus.batteryStatus,
        twelveSoc: resp.result.status.battery.batSoc
      }
    }

    throw Error(`Failed to retrieve vehicle status: ${resp}`)
  }
  
}