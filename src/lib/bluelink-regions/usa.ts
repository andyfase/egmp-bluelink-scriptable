import {
  Bluelink,
  BluelinkTokens,
  BluelinkCar,
  BluelinkStatus,
  // ClimateRequest,
  DEFAULT_STATUS_CHECK_INTERVAL,
} from './base'
import { Config } from '../../config'

const DEFAULT_API_DOMAIN = 'https://api.telematics.hyundaiusa.com/ac/v2/'
const API_DOMAINS: Record<string, string> = {
  hyundai: 'https://api.telematics.hyundaiusa.com/ac/v2/',
}

export class BluelinkUSA extends Bluelink {
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
      gen: '2',
      client_id: 'm66129Bb-em93-SPAHYN-bZ91-am4540zp19920',
      clientSecret: 'v558o935-6nne-423i-baa8',
      username: this.config.auth.username,
      blueLinkServicePin: this.config.auth.pin,
    }
    this.authHeader = 'accessToken'
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
    const obj = new BluelinkUSA(config, statusCheckInterval)
    await obj.superInit(config)
    return obj
  }

  private requestResponseValid(resp: Record<string, any>): boolean {
    if (Object.hasOwn(resp, 'statusCode') && resp['statusCode'] == '200') {
      return true
    }
    return false
  }

  private carHeaders(): Record<string, string> {
    return {
      registrationId: this.cache.car.id,
      vin: this.cache.car.vin,
    }
  }

  protected async login(): Promise<BluelinkTokens | undefined> {
    const resp = await this.request({
      url: this.apiDomain.replace('/ac/v2/', '/v2/ac/oauth/token'),
      data: JSON.stringify({
        username: this.config.auth.username,
        password: this.config.auth.password,
      }),
      noAuth: true,
    })
    if (this.requestResponseValid(resp.resp)) {
      return {
        accessToken: resp.json.access_token,
        refreshToken: resp.json.refresh_token,
        expiry: Math.floor(Date.now() / 1000) + resp.json.result.token.expires_in, // we only get a expireIn not a actual date
      }
    }

    const error = `Login Failed: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) await this.logger.log(error)
    return undefined
  }

  protected async refreshTokens(): Promise<BluelinkTokens | undefined> {
    const resp = await this.request({
      url: this.apiDomain.replace('/ac/v2/', '/v2/ac/oauth/token/refresh'),
      data: JSON.stringify({
        refresh_token: this.cache.token.refreshToken,
      }),
      noAuth: true,
    })
    if (this.requestResponseValid(resp.resp)) {
      return {
        accessToken: resp.json.access_token,
        refreshToken: resp.json.refresh_token,
        expiry: Math.floor(Date.now() / 1000) + resp.json.result.token.expires_in, // we only get a expireIn not a actual date
      }
    }

    const error = `Login Failed: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) await this.logger.log(error)
    return undefined
  }

  protected async getCar(): Promise<BluelinkCar> {
    const resp = await this.request({
      url: this.apiDomain + `enrollment/details/${this.config.auth.username}`,
      method: 'POST',
    })
    if (this.requestResponseValid(resp.resp) && resp.json.enrolledVehicleDetails.length > 0) {
      let vehicle = resp.json.result.enrolledVehicleDetails[0]
      if (this.vin) {
        for (const v of resp.json.result.enrolledVehicleDetails) {
          if (v.vin === this.vin) {
            vehicle = v
            break
          }
        }
      }

      return {
        id: vehicle.regid,
        vin: vehicle.vin,
        nickName: vehicle.nickName,
        modelName: vehicle.modelCode,
        modelYear: vehicle.modelYear,
        // colour and trim dont exist in US implementation
        // modelColour: vehicle.exteriorColor,
        // modelTrim: vehicle.trim,
      }
    }
    const error = `Failed to retrieve vehicle list: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) await this.logger.log(error)
    throw Error(error)
  }

  protected returnCarStatus(status: any, forceUpdate: boolean): BluelinkStatus {
    // format "2025-01-30T00:38:15Z" - which is standard
    const lastRemoteCheck = new Date(status.dateTime)

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
      odometer: status.odometer ? status.odometer : 0,
    }
  }

  protected async getCarStatus(id: string, forceUpdate: boolean): Promise<BluelinkStatus> {
    const api = 'rcs/rvs/vehicleStatus'
    const resp = await this.request({
      url: this.apiDomain + api,
      headers: {
        ...this.carHeaders(),
        ...(forceUpdate && {
          REFRESH: 'true',
        }),
      },
    })

    if (this.requestResponseValid(resp.resp)) {
      return this.returnCarStatus(resp.json.vehicleStatus, forceUpdate)
    }

    const error = `Failed to retrieve vehicle status: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) await this.logger.log(error)
    throw Error(error)
  }
}
