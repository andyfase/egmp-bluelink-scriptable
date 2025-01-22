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

import { Bluelink, BluelinkCreds, BluelinkTokens, BluelinkCar, BluelinkStatus, ClimateRequest } from './base'

const API_DOMAIN = 'https://mybluelink.ca/tods/api/'
const MAX_COMPLETION_POLLS = 30

export class BluelinkCanada extends Bluelink {
  constructor(creds: BluelinkCreds, vin?: string, statusCheckInterval?: number) {
    super(creds, vin)
    this.statusCheckInterval = statusCheckInterval || 600
    this.additionalHeaders = {
      from: 'SPA',
      language: '0',
      offset: `-${new Date().getTimezoneOffset() / 60}`,
    }
    this.authHeader = 'Accesstoken'
    this.tempLookup = {
      F: [62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82],
      C: [17, 17.5, 18, 18.5, 19, 19.5, 20, 20.5, 21, 21.5, 22, 22.5, 23, 23.5, 24, 24.5, 25, 25.5, 26, 26.5, 27],
      H: [
        '06H',
        '07H',
        '08H',
        '09H',
        '0AH',
        '0BH',
        '0CH',
        '0DH',
        '0EH',
        '0FH',
        '10H',
        '11H',
        '12H',
        '13H',
        '14H',
        '15H',
        '16H',
        '17H',
        '18H',
        '19H',
        '1AH',
      ],
    }
  }

  static async init(creds: BluelinkCreds, vin?: string, statusCheckInterval?: number) {
    const obj = new BluelinkCanada(creds, vin, statusCheckInterval)
    await obj.superInit(creds, vin)
    return obj
  }

  private requestResponseValid(payload: any): boolean {
    if (Object.hasOwn(payload, 'responseHeader') && payload.responseHeader.responseCode == 0) {
      return true
    }
    return false
  }

  protected async login(): Promise<BluelinkTokens> {
    const resp = await this.request({
      url: API_DOMAIN + 'v2/login',
      data: JSON.stringify({
        loginId: this.creds.username,
        password: this.creds.password,
      }),
      noAuth: true,
    })
    if (this.requestResponseValid(resp)) {
      return {
        accessToken: resp.result.token.accessToken,
        expiry: Math.floor(Date.now() / 1000) + resp.result.token.expireIn, // we only get a expireIn not a actual date
      }
    }
    throw Error(`Login Failed: ${JSON.stringify(resp)} request ${JSON.stringify(this.debugLastRequest)}`)
  }

  protected async setCar(id: string) {
    const resp = await this.request({
      url: API_DOMAIN + 'vhcllst',
      data: JSON.stringify({
        vehicleId: id,
      }),
    })
    if (!this.requestResponseValid(resp)) {
      throw Error(`Failed to set car ${id}: ${JSON.stringify(resp)} request ${JSON.stringify(this.debugLastRequest)}`)
    }
  }

  protected async getCar(): Promise<BluelinkCar> {
    const resp = await this.request({
      url: API_DOMAIN + 'vhcllst',
      method: 'POST',
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
      }
    }
    throw Error(
      `Failed to retrieve vehicle list: ${JSON.stringify(resp)} request ${JSON.stringify(this.debugLastRequest)}`,
    )
  }

  protected async getCarStatus(id: string, forceUpdate: boolean): Promise<BluelinkStatus> {
    const api = forceUpdate ? 'rltmvhclsts' : 'sltvhcl'
    const resp = await this.request({
      url: API_DOMAIN + api,
      method: 'POST',
      ...(!forceUpdate && {
        data: JSON.stringify({
          vehicleId: id,
        }),
      }),
      headers: {
        Vehicleid: id,
      },
    })

    if (this.requestResponseValid(resp)) {
      return {
        lastStatusCheck: Math.floor(Date.now() / 1000),
        lastRemoteStatusCheck: resp.result.status.lastStatusDate,
        isCharging: resp.result.status.evStatus.batteryCharge,
        chargingPower:
          resp.result.status.evStatus.batteryPower.batteryFstChrgPower > 0
            ? resp.result.status.evStatus.batteryPower.batteryFstChrgPower
            : resp.result.status.evStatus.batteryPower.batteryStndChrgPower,
        remainingChargeTimeMins: resp.result.status.evStatus.remainTime2.atc.value,
        range: resp.result.status.evStatus.drvDistance[0].rangeByFuel.evModeRange.value,
        locked: resp.result.status.doorLock,
        climate: resp.result.status.airCtrlOn,
        soc: resp.result.status.evStatus.batteryStatus,
        twelveSoc: resp.result.status.battery.batSoc,
        odometer: !forceUpdate ? resp.result.vehicle.odometer : this.cache.status.odometer,
      }
    }

    throw Error(
      `Failed to retrieve vehicle status: ${JSON.stringify(resp)} request ${JSON.stringify(this.debugLastRequest)}`,
    )
  }

  protected async getAuthCode(): Promise<string> {
    const api = 'vrfypin'
    const resp = await this.request({
      url: API_DOMAIN + api,
      method: 'POST',
      data: JSON.stringify({
        pin: this.creds.pin,
      }),
    })
    if (this.requestResponseValid(resp)) {
      return resp.result.pAuth
    }
    throw Error(`Failed to get auth code: ${JSON.stringify(resp)} request ${JSON.stringify(this.debugLastRequest)}`)
  }

  protected async pollForCommandCompletion(id: string, authCode: string): Promise<{ isSuccess: boolean; data: any }> {
    const api = 'rmtsts'
    let attempts = 0
    while (attempts <= MAX_COMPLETION_POLLS) {
      const resp = await this.request({
        url: API_DOMAIN + api,
        method: 'POST',
        headers: {
          Vehicleid: id,
          Pauth: authCode,
        },
      })
      // ignore failures in loop
      if (this.requestResponseValid(resp) && resp.result.transaction.apiResult === 'C') {
        return {
          isSuccess: true,
          data: resp.result.vehicle,
        }
      }
      attempts += 1
      await this.sleep(1000)
    }
    return {
      isSuccess: false,
      data: undefined,
    }
  }

  protected async lock(id: string): Promise<{ isSuccess: boolean; data: any }> {
    return await this.lockUnlock(id, true)
  }

  protected async unlock(id: string): Promise<{ isSuccess: boolean; data: any }> {
    return await this.lockUnlock(id, false)
  }

  protected async lockUnlock(id: string, shouldLock: boolean): Promise<{ isSuccess: boolean; data: any }> {
    const authCode = await this.getAuthCode()
    const api = shouldLock ? 'drlck' : 'drulck'
    const resp = await this.request({
      url: API_DOMAIN + api,
      method: 'POST',
      data: JSON.stringify({
        pin: this.creds.pin,
      }),
      headers: {
        Vehicleid: id,
        Pauth: authCode,
      },
    })
    if (this.requestResponseValid(resp)) return await this.pollForCommandCompletion(id, authCode)
    throw Error(
      `Failed to send lockUnlock command: ${JSON.stringify(resp)} request ${JSON.stringify(this.debugLastRequest)}`,
    )
  }

  protected async startCharge(id: string): Promise<{ isSuccess: boolean; data: any }> {
    return await this.chargeStopCharge(id, true)
  }

  protected async stopCharge(id: string): Promise<{ isSuccess: boolean; data: any }> {
    return await this.chargeStopCharge(id, false)
  }

  protected async chargeStopCharge(id: string, shouldCharge: boolean): Promise<{ isSuccess: boolean; data: any }> {
    const authCode = await this.getAuthCode()
    const api = shouldCharge ? 'evc/rcstrt' : 'evc/rcstp'
    const resp = await this.request({
      url: API_DOMAIN + api,
      method: 'POST',
      data: JSON.stringify({
        pin: this.creds.pin,
      }),
      headers: {
        Vehicleid: id,
        Pauth: authCode,
      },
    })
    if (this.requestResponseValid(resp)) return await this.pollForCommandCompletion(id, authCode)
    throw Error(
      `Failed to send charge command: ${JSON.stringify(resp)} request ${JSON.stringify(this.debugLastRequest)}`,
    )
  }

  protected async climateOn(id: string, config: ClimateRequest): Promise<{ isSuccess: boolean; data: any }> {
    if (!this.tempLookup) {
      throw Error(`Mis-Configured sub-class - no temp lookup defined`)
    }
    const tempIndex = this.tempLookup.C.indexOf(config.temp)

    if (!tempIndex || tempIndex == -1) {
      throw Error(`Failed to convert temp ${config.temp} in climateOn command`)
    }

    const authCode = await this.getAuthCode()
    const api = 'evc/rfon'
    const resp = await this.request({
      url: API_DOMAIN + api,
      method: 'POST',
      data: JSON.stringify({
        pin: this.creds.pin,
        hvacInfo: {
          airCtrl: 1,
          defrost: config.defrost,
          airTemp: {
            value: this.tempLookup.H[tempIndex],
            unit: 0,
            hvacTempType: 1,
          },
          igniOnDuration: config.durationMinutes,
          heating1: config.steering ? 4 : 0,
        },
      }),
      headers: {
        Vehicleid: id,
        Pauth: authCode,
      },
    })
    if (this.requestResponseValid(resp)) return await this.pollForCommandCompletion(id, authCode)
    throw Error(
      `Failed to send climateOff command: ${JSON.stringify(resp)} request ${JSON.stringify(this.debugLastRequest)}`,
    )
  }

  protected async climateOff(id: string): Promise<{ isSuccess: boolean; data: any }> {
    const authCode = await this.getAuthCode()
    const api = 'evc/rfoff'
    const resp = await this.request({
      url: API_DOMAIN + api,
      method: 'POST',
      data: JSON.stringify({
        pin: this.creds.pin,
      }),
      headers: {
        Vehicleid: id,
        Pauth: authCode,
      },
    })
    if (this.requestResponseValid(resp)) return await this.pollForCommandCompletion(id, authCode)
    throw Error(
      `Failed to send climateOff command: ${JSON.stringify(resp)} request ${JSON.stringify(this.debugLastRequest)}`,
    )
  }
}
