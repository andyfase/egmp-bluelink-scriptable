import {
  Bluelink,
  BluelinkTokens,
  BluelinkCar,
  BluelinkStatus,
  // ClimateRequest,
  DEFAULT_STATUS_CHECK_INTERVAL,
  MAX_COMPLETION_POLLS,
} from './base'
import { Config } from '../../config'

const DEFAULT_API_DOMAIN = 'api.owners.kia.com'
const LOGIN_EXPIRY = 24 * 60 * 60 * 1000

export class BluelinkUSAKia extends Bluelink {
  constructor(config: Config, statusCheckInterval?: number) {
    super(config)
    this.distanceUnit = 'mi'
    this.apiDomain = `https://${DEFAULT_API_DOMAIN}/apigw/v1/`

    this.statusCheckInterval = statusCheckInterval || DEFAULT_STATUS_CHECK_INTERVAL
    this.additionalHeaders = {
      from: 'SPA',
      language: '0',
      offset: this.getTimeZone().slice(0, 3),
      appType: 'L',
      appVersion: '7.12.1',
      clientId: 'MWAMOBILE',
      osType: 'Android',
      osVersion: '14',
      secretKey: '98er-w34rf-ibf3-3f6h',
      to: 'APIGW',
      tokenType: 'G',
      'User-Agent': 'okhttp/4.10.0',
      deviceId: `${this.genRanHex(22)}:${this.genRanHex(9)}_${this.genRanHex(10)}-${this.genRanHex(5)}_${this.genRanHex(22)}_${this.genRanHex(8)}-${this.genRanHex(18)}-_${this.genRanHex(22)}_${this.genRanHex(17)}`,
      Host: DEFAULT_API_DOMAIN,
    }

    this.authHeader = 'sid'
  }

  static async init(config: Config, vin?: string, statusCheckInterval?: number) {
    const obj = new BluelinkUSAKia(config, statusCheckInterval)
    await obj.superInit(config)
    return obj
  }

  private getDateString(): string {
    return new Date()
      .toLocaleDateString('en-GB', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        timeZone: 'Europe/London',
        timeZoneName: 'short',
      })
      .replace(' at', '')
  }

  private requestResponseValid(
    resp: Record<string, any>,
    data: Record<string, any>,
  ): { valid: boolean; retry: boolean } {
    if (Object.hasOwn(resp, 'statusCode') && resp.statusCode !== 200) {
      return { valid: false, retry: true }
    }
    if (Object.hasOwn(data, 'status') && Object.hasOwn(data.status, 'statusCode') && data.status.statusCode === 0) {
      return { valid: true, retry: false }
    }
    return { valid: false, retry: true }
  }

  protected async login(): Promise<BluelinkTokens | undefined> {
    const resp = await this.request({
      url: this.apiDomain + 'prof/authUser',
      data: JSON.stringify({
        deviceKey: '',
        deviceType: 2,
        userCredential: {
          userId: this.config.auth.username,
          password: this.config.auth.password,
        },
      }),
      headers: {
        date: this.getDateString(),
      },
      noAuth: true,
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      // update tokens used in this session as we may need to call getCar before we write the new tokens to cache
      this.tokens = {
        accessToken: this.caseInsensitiveParamExtraction('sid', resp.resp.headers) || '',
        refreshToken: '', // seemingly KIA us doesnt support refresh?
        expiry: Math.floor(Date.now() / 1000) + Number(LOGIN_EXPIRY), // we also dont get an expiry?
        authCookie: undefined,
      }
      // check if cache is present (hence this is a re-auth) if so we need to re-save the car status as the car ID changes per session
      if (this.cache && this.cache.car) {
        this.cache.car = await this.getCar(true)
        this.saveCache()
      }
      return this.tokens
    }

    const error = `Login Failed: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    return undefined
  }

  protected async getCar(noRetry = false): Promise<BluelinkCar> {
    let vin = this.vin
    if (!vin && this.cache) {
      vin = this.cache.car.vin
    }

    const resp = await this.request({
      url: this.apiDomain + 'ownr/gvl',
      headers: {
        date: this.getDateString(),
        'Content-Type': 'application/json', // mandatory Content-Type on GET calls is mind-blowing bad!!!
      },
      noRetry: noRetry,
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid && resp.json.payload.vehicleSummary.length > 0) {
      let vehicle = resp.json.payload.vehicleSummary[0]
      if (vin) {
        for (const v of resp.json.payload.vehicleSummary) {
          if (v.key === vin) {
            vehicle = v
            break
          }
        }
      }

      return {
        id: vehicle.vehicleKey,
        vin: vehicle.vin,
        nickName: vehicle.nickName,
        modelName: vehicle.modelName,
        modelYear: vehicle.modelYear,
        odometer: vehicle.mileage,
        modelColour: vehicle.colorName,
        modelTrim: vehicle.trim,
      }
    }
    const error = `Failed to retrieve vehicle list: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected returnCarStatus(status: any): BluelinkStatus {
    const lastRemoteCheckString = status.syncDate.utc + 'Z'
    const df = new DateFormatter()
    df.dateFormat = 'yyyyMMddHHmmssZ'
    const lastRemoteCheck = df.date(lastRemoteCheckString)

    return {
      lastStatusCheck: Date.now(),
      lastRemoteStatusCheck: lastRemoteCheck.getTime(),
      isCharging: status.evStatus.batteryCharge,
      isPluggedIn: status.evStatus.pluggedInState > 0 ? true : false,
      chargingPower:
        status.evStatus.pluggedInState > 0 && status.evStatus.batteryCharge ? status.evStatus.realTimePower : 0,
      remainingChargeTimeMins: status.evStatus.remainChargeTime[0].timeInterval.value,
      // sometimes range back as zero? if so ignore and use cache
      range:
        status.evStatus.drvDistance[0].rangeByFuel.evModeRange.value > 0
          ? status.evStatus.drvDistance[0].rangeByFuel.evModeRange.value
          : this.cache
            ? this.cache.status.range
            : 0,
      locked: status.doorLock,
      climate: status.climate.airCtrl,
      soc: status.evStatus.batteryStatus,
      twelveSoc: status.batteryStatus.stateOfCharge ? status.batteryStatus.stateOfCharge : 0,
      odometer: 0, // not given in status
    }
  }

  protected async getCarStatus(id: string, forceUpdate: boolean): Promise<BluelinkStatus> {
    if (!forceUpdate) {
      const resp = await this.request({
        url: this.apiDomain + 'cmm/gvi',
        data: JSON.stringify({
          vehicleConfigReq: {
            airTempRange: '0',
            maintenance: '0',
            seatHeatCoolOption: '0',
            vehicle: '1',
            vehicleFeature: '0',
          },
          vehicleInfoReq: {
            drivingActivty: '0',
            dtc: '1',
            enrollment: '0',
            functionalCards: '0',
            location: '0',
            vehicleStatus: '1',
            weather: '0',
          },
          vinKey: [id],
        }),
        headers: {
          date: this.getDateString(),
          vinkey: id,
        },
        validResponseFunction: this.requestResponseValid,
      })

      if (this.requestResponseValid(resp.resp, resp.json).valid) {
        return this.returnCarStatus(resp.json.payload.vehicleInfoList[0].lastVehicleInfo.vehicleStatusRpt.vehicleStatus)
      }
      const error = `Failed to retrieve vehicle status: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    // force update seems to return cached data initially hence we ignore the response and poll until the cached data is updated
    const currentTime = Date.now()

    const resp = await this.request({
      url: this.apiDomain + 'rems/rvs',
      data: JSON.stringify({
        requestType: 0,
      }),
      headers: {
        date: this.getDateString(),
        vinkey: id,
      },
      validResponseFunction: this.requestResponseValid,
    })

    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      // poll cached status API until the date is above currentTime
      let attempts = 0
      let resp = undefined
      while (attempts <= MAX_COMPLETION_POLLS) {
        attempts += 1
        await this.sleep(2000)
        resp = await this.getCarStatus(id, false)
        if (currentTime < resp.lastRemoteStatusCheck) {
          return resp
        }
      }
    }

    const error = `Failed to retrieve vehicle status: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async pollForCommandCompletion(
    id: string,
    transactionId: string,
  ): Promise<{ isSuccess: boolean; data: any }> {
    let attempts = 0
    while (attempts <= 5) {
      const resp = await this.request({
        url: this.apiDomain + 'cmm/gts',
        data: JSON.stringify({
          xid: transactionId,
        }),
        headers: {
          date: this.getDateString(),
          vinkey: id,
        },
        validResponseFunction: this.requestResponseValid,
      })

      if (!this.requestResponseValid(resp.resp, resp.json).valid) {
        const error = `Failed to poll for command completion: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
        if (this.config.debugLogging) this.logger.log(error)
        throw Error(error)
      }

      // iterate over all actions and ensure they are all zero?
      // this doesnt detect failure and will just timeout - so this makes not a lot of sense, wait to refactor until we get logs
      for (const record of resp.json.payload) {
        if (record === 0) {
          return {
            isSuccess: true,
            data: (await this.getStatus(false, true)).status,
          }
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
    const api = shouldLock ? 'rems/door/lock' : 'rems/door/unlock'

    const resp = await this.request({
      url: this.apiDomain + api,
      method: 'GET',
      headers: {
        date: this.getDateString(),
        vinkey: id,
        'Content-Type': 'application/json', // mandatory Content-Type on GET calls is mind-blowing bad!!!
      },
      notJSON: true,
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      const transactionId = this.caseInsensitiveParamExtraction('Xid', resp.resp.headers)
      if (transactionId) return await this.pollForCommandCompletion(id, transactionId)
    }
    const error = `Failed to send lockUnlock command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }
}
