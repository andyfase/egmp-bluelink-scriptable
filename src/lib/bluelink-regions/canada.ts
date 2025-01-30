import {
  Bluelink,
  BluelinkTokens,
  BluelinkCar,
  BluelinkStatus,
  ClimateRequest,
  DEFAULT_STATUS_CHECK_INTERVAL,
} from './base'
import { Config } from '../../config'

const DEFAULT_API_DOMAIN = 'https://mybluelink.ca/tods/api/'
const API_DOMAINS: Record<string, string> = {
  hyundai: 'https://mybluelink.ca/tods/api/',
  kia: 'https://kiaconnect.ca/tods/api/',
}

const MAX_COMPLETION_POLLS = 20

export class BluelinkCanada extends Bluelink {
  constructor(config: Config, statusCheckInterval?: number) {
    super(config)
    this.apiDomain = config.manufacturer
      ? this.getApiDomain(config.manufacturer, API_DOMAINS, DEFAULT_API_DOMAIN)
      : DEFAULT_API_DOMAIN
    this.statusCheckInterval = statusCheckInterval || DEFAULT_STATUS_CHECK_INTERVAL
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
    const obj = new BluelinkCanada(config, statusCheckInterval)
    await obj.superInit(config)
    return obj
  }

  private requestResponseValid(payload: any): boolean {
    if (Object.hasOwn(payload, 'responseHeader') && payload.responseHeader.responseCode == 0) {
      return true
    }
    return false
  }

  protected async login(): Promise<BluelinkTokens | undefined> {
    const resp = await this.request({
      url: this.apiDomain + 'v2/login',
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

    const error = `Login Failed: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) await this.logger.log(error)
    return undefined
  }

  protected async setCar(id: string) {
    const resp = await this.request({
      url: this.apiDomain + 'vhcllst',
      data: JSON.stringify({
        vehicleId: id,
      }),
    })
    if (!this.requestResponseValid(resp.json)) {
      const error = `Failed to set car ${id}: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) await this.logger.log(error)
      throw Error(error)
    }
  }

  protected async getCar(): Promise<BluelinkCar> {
    const resp = await this.request({
      url: this.apiDomain + 'vhcllst',
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
    const error = `Failed to retrieve vehicle list: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) await this.logger.log(error)
    throw Error(error)
  }

  protected returnCarStatus(status: any, forceUpdate: boolean, odometer?: number): BluelinkStatus {
    const lastRemoteCheckString = status.lastStatusDate + 'Z'
    const df = new DateFormatter()
    df.dateFormat = 'yyyyMMddHHmmssZ'
    const lastRemoteCheck = df.date(lastRemoteCheckString)

    // For whatever reason sometimes the status will not have the evStatus object
    // deal with that with either cached or zero values
    if (!status.evStatus) {
      return {
        lastStatusCheck: Date.now(),
        lastRemoteStatusCheck: forceUpdate ? Date.now() : lastRemoteCheck.getTime(),
        isCharging: this.cache ? this.cache.status.isCharging : false,
        isPluggedIn: this.cache ? this.cache.status.isCharging : false,
        chargingPower: this.cache ? this.cache.status.chargingPower : 0,
        remainingChargeTimeMins: this.cache ? this.cache.status.remainingChargeTimeMins : 0,
        range: this.cache ? this.cache.status.range : 0,
        soc: this.cache ? this.cache.status.soc : 0,
        locked: status.doorLock,
        climate: status.airCtrlOn,
        twelveSoc: status.battery.batSoc,
        odometer: odometer ? odometer : this.cache ? this.cache.status.odometer : 0,
      }
    }

    return {
      lastStatusCheck: Date.now(),
      lastRemoteStatusCheck: forceUpdate ? Date.now() : lastRemoteCheck.getTime(),
      isCharging: status.evStatus.batteryCharge,
      isPluggedIn: status.evStatus.batteryPlugin > 0 ? true : false,
      chargingPower: status.evStatus.batteryCharge // only check for charging power if actually charging
        ? (status.evStatus.batteryPower.batteryFstChrgPower && status.evStatus.batteryPower.batteryFstChrgPower) > 0
          ? status.evStatus.batteryPower.batteryFstChrgPower
          : status.evStatus.batteryPower.batteryStndChrgPower
        : 0,
      remainingChargeTimeMins: status.evStatus.remainTime2.atc.value,
      // sometimes range back as zero? if so ignore and use cache
      range:
        status.evStatus.drvDistance[0].rangeByFuel.evModeRange.value > 0
          ? status.evStatus.drvDistance[0].rangeByFuel.evModeRange.value
          : this.cache
            ? this.cache.status.range
            : 0,
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
      url: this.apiDomain + api,
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

    const error = `Failed to retrieve vehicle status: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) await this.logger.log(error)
    throw Error(error)
  }

  protected async getAuthCode(): Promise<string> {
    const api = 'vrfypin'
    const resp = await this.request({
      url: this.apiDomain + api,
      method: 'POST',
      data: JSON.stringify({
        pin: this.config.auth.pin,
      }),
    })
    if (this.requestResponseValid(resp.json)) {
      return resp.json.result.pAuth
    }
    const error = `Failed to get auth code: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) await this.logger.log(error)
    throw Error(error)
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
        url: this.apiDomain + api,
        method: 'POST',
        headers: {
          Vehicleid: id,
          Pauth: authCode,
          TransactionId: transactionId,
        },
      })

      if (!this.requestResponseValid(resp.json)) {
        const error = `Failed to poll for command completion: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
        if (this.config.debugLogging) await this.logger.log(error)
        throw Error(error)
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
      url: this.apiDomain + api,
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
    const error = `Failed to send lockUnlock command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) await this.logger.log(error)
    throw Error(error)
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
      url: this.apiDomain + api,
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
    const error = `Failed to send charge command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) await this.logger.log(error)
    throw Error(error)
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
      url: this.apiDomain + api,
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
    const error = `Failed to send climateOff command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) await this.logger.log(error)
    throw Error(error)
  }

  protected async climateOff(id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const authCode = await this.getAuthCode()
    const api = 'evc/rfoff'
    const resp = await this.request({
      url: this.apiDomain + api,
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
    const error = `Failed to send climateOff command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) await this.logger.log(error)
    throw Error(error)
  }
}
