import { Bluelink, BluelinkTokens, BluelinkCar, BluelinkStatus, ClimateRequest } from './base'
import { Config } from '../../config'

const API_DOMAIN = 'https://mybluelink.ca/tods/api/'
const MAX_COMPLETION_POLLS = 20

export class BluelinkCanada extends Bluelink {
  constructor(config: Config, vin?: string, statusCheckInterval?: number) {
    super(config, vin)
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

  static async init(config: Config, vin?: string, statusCheckInterval?: number) {
    const obj = new BluelinkCanada(config, vin, statusCheckInterval)
    await obj.superInit(config, vin)
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
        loginId: this.config.auth.username,
        password: this.config.auth.password,
      }),
      noAuth: true,
    })
    if (this.requestResponseValid(resp.json)) {
      return {
        accessToken: resp.json.result.token.accessToken,
        expiry: Math.floor(Date.now() / 1000) + resp.json.result.token.expireIn, // we only get a expireIn not a actual date
      }
    }
    throw Error(`Login Failed: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`)
  }

  protected async setCar(id: string) {
    const resp = await this.request({
      url: API_DOMAIN + 'vhcllst',
      data: JSON.stringify({
        vehicleId: id,
      }),
    })
    if (!this.requestResponseValid(resp.json)) {
      throw Error(
        `Failed to set car ${id}: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`,
      )
    }
  }

  protected async getCar(): Promise<BluelinkCar> {
    const resp = await this.request({
      url: API_DOMAIN + 'vhcllst',
      method: 'POST',
    })
    if (this.requestResponseValid(resp.json) && resp.json.result.vehicles.length > 0) {
      let vehicle = resp.json.result.vehicles[0]
      if (this.vin) {
        for (const v of resp.json.result.vehicles) {
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
      `Failed to retrieve vehicle list: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`,
    )
  }

  protected returnCarStatus(status: any, forceUpdate: boolean, odometer?: number): BluelinkStatus {
    return {
      lastStatusCheck: Math.floor(Date.now() / 1000),
      ...(forceUpdate && {
        lastForcedStatusCheck: Math.floor(Date.now() / 1000),
      }),
      lastRemoteStatusCheck: status.lastStatusDate,
      isCharging: status.evStatus.batteryCharge,
      isPluggedIn: status.evStatus.batteryPlugin > 0 ? true : false,
      chargingPower:
        status.evStatus.batteryPower.batteryFstChrgPower > 0
          ? status.evStatus.batteryPower.batteryFstChrgPower
          : status.evStatus.batteryPower.batteryStndChrgPower,
      remainingChargeTimeMins: status.evStatus.remainTime2.atc.value,
      range: status.evStatus.drvDistance[0].rangeByFuel.evModeRange.value,
      locked: status.doorLock,
      climate: status.airCtrlOn,
      soc: status.evStatus.batteryStatus,
      twelveSoc: status.battery.batSoc,
      odometer: odometer ? odometer : this.cache ? this.cache.status.odometer : 0,
    }
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

    if (this.requestResponseValid(resp.json)) {
      return forceUpdate
        ? this.returnCarStatus(resp.json.result.status, forceUpdate, resp.json.result.status.odometer)
        : this.returnCarStatus(resp.json.result.status, forceUpdate, resp.json.result.vehicle.odometer)
    }

    throw Error(
      `Failed to retrieve vehicle status: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`,
    )
  }

  protected async getAuthCode(): Promise<string> {
    const api = 'vrfypin'
    const resp = await this.request({
      url: API_DOMAIN + api,
      method: 'POST',
      data: JSON.stringify({
        pin: this.config.auth.pin,
      }),
    })
    if (this.requestResponseValid(resp.json)) {
      return resp.json.result.pAuth
    }
    throw Error(
      `Failed to get auth code: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`,
    )
  }

  protected async pollForCommandCompletion(
    id: string,
    authCode: string,
    transactionId: string,
  ): Promise<{ isSuccess: boolean; data: any }> {
    const api = 'rmtsts'
    let attempts = 0
    while (attempts <= MAX_COMPLETION_POLLS) {
      const resp = await this.request({
        url: API_DOMAIN + api,
        method: 'POST',
        headers: {
          Vehicleid: id,
          Pauth: authCode,
          TransactionId: transactionId,
        },
      })

      if (!this.requestResponseValid(resp.json)) {
        throw Error(
          `Failed to poll for command completion: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`,
        )
      }

      if (resp.json.result.transaction.apiResult === 'C') {
        // update saved cache status
        if (resp.json.result.vehicle) {
          this.cache.status = this.returnCarStatus(resp.json.result.vehicle, true)
          this.saveCache()
        }
        return {
          isSuccess: true,
          data: this.cache.status,
        }
      }
      attempts += 1
      await this.sleep(2000)
    }
    return {
      isSuccess: false,
      data: undefined,
    }
  }

  protected async lock(id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    return await this.lockUnlock(id, true)
  }

  protected async unlock(id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    return await this.lockUnlock(id, false)
  }

  protected async lockUnlock(id: string, shouldLock: boolean): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const authCode = await this.getAuthCode()
    const api = shouldLock ? 'drlck' : 'drulck'
    const resp = await this.request({
      url: API_DOMAIN + api,
      method: 'POST',
      data: JSON.stringify({
        pin: this.config.auth.pin,
      }),
      headers: {
        Vehicleid: id,
        Pauth: authCode,
      },
    })
    if (this.requestResponseValid(resp.json)) {
      const transactionId = resp.resp.headers.transactionId
      return await this.pollForCommandCompletion(id, authCode, transactionId)
    }
    throw Error(
      `Failed to send lockUnlock command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`,
    )
  }

  protected async startCharge(id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    return await this.chargeStopCharge(id, true)
  }

  protected async stopCharge(id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    return await this.chargeStopCharge(id, false)
  }

  protected async chargeStopCharge(
    id: string,
    shouldCharge: boolean,
  ): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const authCode = await this.getAuthCode()
    const api = shouldCharge ? 'evc/rcstrt' : 'evc/rcstp'
    const resp = await this.request({
      url: API_DOMAIN + api,
      method: 'POST',
      data: JSON.stringify({
        pin: this.config.auth.pin,
      }),
      headers: {
        Vehicleid: id,
        Pauth: authCode,
      },
    })
    if (this.requestResponseValid(resp.json)) {
      const transactionId = resp.resp.headers.transactionId
      return await this.pollForCommandCompletion(id, authCode, transactionId)
    }
    throw Error(
      `Failed to send charge command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`,
    )
  }

  protected async climateOn(id: string, config: ClimateRequest): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
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
        pin: this.config.auth.pin,
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
    if (this.requestResponseValid(resp.json)) {
      const transactionId = resp.resp.headers.transactionId
      return await this.pollForCommandCompletion(id, authCode, transactionId)
    }
    throw Error(
      `Failed to send climateOff command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`,
    )
  }

  protected async climateOff(id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const authCode = await this.getAuthCode()
    const api = 'evc/rfoff'
    const resp = await this.request({
      url: API_DOMAIN + api,
      method: 'POST',
      data: JSON.stringify({
        pin: this.config.auth.pin,
      }),
      headers: {
        Vehicleid: id,
        Pauth: authCode,
      },
    })
    if (this.requestResponseValid(resp.json)) {
      const transactionId = resp.resp.headers.transactionId
      return await this.pollForCommandCompletion(id, authCode, transactionId)
    }
    throw Error(
      `Failed to send climateOff command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`,
    )
  }
}
