import {
  Bluelink,
  BluelinkTokens,
  BluelinkCar,
  BluelinkStatus,
  // ClimateRequest,
  DEFAULT_STATUS_CHECK_INTERVAL,
  // MAX_COMPLETION_POLLS,
} from './base'
import { Config } from '../../config'

const DEFAULT_API_DOMAIN = 'api.owners.kia.com'
const LOGIN_EXPIRY = 24 * 60 * 60 * 1000

export class BluelinkUSAKia extends Bluelink {
  private carVin: string | undefined

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

  private carHeaders(): Record<string, string> {
    return {
      // on first load cache is not populated - hence default to optional local vars set when fetching the car.
      vinkey: this.cache ? this.cache.car.vin : this.carVin!,
    }
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
      return {
        accessToken: this.caseInsensitiveParamExtraction('sid', resp.resp.headers) || '',
        refreshToken: '', // seemingly KIA us doesnt support refresh?
        expiry: Math.floor(Date.now() / 1000) + Number(LOGIN_EXPIRY), // we also dont get an expiry?
        authCookie: undefined,
      }
    }

    const error = `Login Failed: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    return undefined
  }

  protected async getCar(): Promise<BluelinkCar> {
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

      this.carVin = vehicle.key
      return {
        id: vehicle.vehicleIdentifier,
        vin: vehicle.key,
        nickName: vehicle.nickName,
        modelName: vehicle.modelCode,
        modelYear: vehicle.modelYear,
        odometer: vehicle.odometer ? vehicle.odometer : 0,
        // colour and trim dont exist in US implementation
        // modelColour: vehicle.exteriorColor,
        // modelTrim: vehicle.trim,
      }
    }
    const error = `Failed to retrieve vehicle list: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  // This is a straight copy from Hyndai USA and needs to be refactored
  protected returnCarStatus(status: any, forceUpdate: boolean): BluelinkStatus {
    // format "2025-01-30T00:38:15Z" - which is standard
    const lastRemoteCheck = new Date(status.dateTime)

    // deal with charging speed - JSON response if variable / inconsistent - hence check for various objects
    let chargingPower = 0
    let isCharging = false
    if (status.evStatus.batteryCharge) {
      isCharging = true
      if (status.evStatus.batteryFstChrgPower && status.evStatus.batteryFstChrgPower > 0) {
        chargingPower = status.evStatus.batteryFstChrgPower
      } else if (status.evStatus.batteryStndChrgPower && status.evStatus.batteryStndChrgPower > 0) {
        chargingPower = status.evStatus.batteryStndChrgPower
      } else {
        // should never get here - log failure to get charging power
        this.logger.log(`Failed to get charging power - ${JSON.stringify(status.evStatus.batteryPower)}`)
      }
    }

    return {
      lastStatusCheck: Date.now(),
      lastRemoteStatusCheck: forceUpdate ? Date.now() : lastRemoteCheck.getTime(),
      isCharging: isCharging,
      isPluggedIn: status.evStatus.batteryPlugin > 0 ? true : false,
      chargingPower: chargingPower,
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
      twelveSoc: status.battery.batSoc ? status.battery.batSoc : 0,
      odometer: status.odometer ? status.odometer : 0,
    }
  }

  protected async getCarStatus(id: string, forceUpdate: boolean): Promise<BluelinkStatus> {
    const api = 'rems/rvs'
    const resp = await this.request({
      url: this.apiDomain + api,
      data: JSON.stringify({
        requestType: forceUpdate ? 0 : 1,
      }),
      headers: {
        ...this.carHeaders(),
      },
      validResponseFunction: this.requestResponseValid,
    })

    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      return this.returnCarStatus(resp.json.vehicleStatus, forceUpdate)
    }

    const error = `Failed to retrieve vehicle status: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }
}
