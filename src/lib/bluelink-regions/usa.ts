import {
  Bluelink,
  BluelinkTokens,
  BluelinkCar,
  BluelinkStatus,
  ClimateRequest,
  DEFAULT_STATUS_CHECK_INTERVAL,
} from './base'
import { Config } from '../../config'

const DEFAULT_API_DOMAIN = 'https://api.telematics.hyundaiusa.com/'
const API_DOMAINS: Record<string, string> = {
  hyundai: 'https://api.telematics.hyundaiusa.com/',
  kia: 'https://api.owners.kia.com/apigw/v1/',
}

export class BluelinkUSA extends Bluelink {
  private carVin: string | undefined
  private carId: string | undefined

  constructor(config: Config, statusCheckInterval?: number) {
    super(config)
    this.distanceUnit = 'mi'
    this.apiDomain = config.manufacturer
      ? this.getApiDomain(config.manufacturer, API_DOMAINS, DEFAULT_API_DOMAIN)
      : DEFAULT_API_DOMAIN

    this.statusCheckInterval = statusCheckInterval || DEFAULT_STATUS_CHECK_INTERVAL
    this.additionalHeaders = {
      from: 'SPA',
      to: 'ISS',
      language: '0',
      offset: `-${new Date().getTimezoneOffset() / 60}`,
      gen: '2',
      client_id:
        config.manufacturer && config.manufacturer === 'kia' ? 'MWAMOBILE' : 'm66129Bb-em93-SPAHYN-bZ91-am4540zp19920',
      clientSecret:
        config.manufacturer && config.manufacturer === 'kia' ? '98er-w34rf-ibf3-3f6h' : 'v558o935-6nne-423i-baa8',
      username: this.config.auth.username,
      blueLinkServicePin: `${this.config.auth.pin}`,
      brandIndicator: 'H',
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

  private requestResponseValid(
    resp: Record<string, any>,
    _data: Record<string, any>,
  ): { valid: boolean; retry: boolean } {
    if (Object.hasOwn(resp, 'statusCode') && resp.statusCode === 200) {
      return { valid: true, retry: false }
    }
    return { valid: false, retry: true }
  }

  private carHeaders(): Record<string, string> {
    return {
      // on first load cache is not populated - hence default to optional local vars set when fetching the car.
      registrationId: this.cache ? this.cache.car.id : this.carId!,
      vin: this.cache ? this.cache.car.vin : this.carVin!,
    }
  }

  protected async login(): Promise<BluelinkTokens | undefined> {
    const resp = await this.request({
      url: this.apiDomain + 'v2/ac/oauth/token',
      data: JSON.stringify({
        username: this.config.auth.username,
        password: this.config.auth.password,
      }),
      noAuth: true,
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      return {
        accessToken: resp.json.access_token,
        refreshToken: resp.json.refresh_token,
        expiry: Math.floor(Date.now() / 1000) + Number(resp.json.expires_in), // we only get a expireIn not a actual date
        authCookie: undefined,
      }
    }

    const error = `Login Failed: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    return undefined
  }

  protected async refreshTokens(): Promise<BluelinkTokens | undefined> {
    if (this.config.debugLogging) this.logger.log('Refreshing tokens')
    const resp = await this.request({
      url: this.apiDomain + 'v2/ac/oauth/token/refresh',
      data: JSON.stringify({
        refresh_token: this.cache.token.refreshToken,
      }),
      noAuth: true,
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      return {
        accessToken: resp.json.access_token,
        refreshToken: resp.json.refresh_token,
        expiry: Math.floor(Date.now() / 1000) + resp.json.expires_in, // we only get a expireIn not a actual date
        authCookie: undefined,
      }
    }

    const error = `Login Failed: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    return undefined
  }

  protected async getCar(): Promise<BluelinkCar> {
    const resp = await this.request({
      url: this.apiDomain + `ac/v2/enrollment/details/${this.config.auth.username}`,
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid && resp.json.enrolledVehicleDetails.length > 0) {
      let vehicle = resp.json.enrolledVehicleDetails[0].vehicleDetails
      if (this.vin) {
        for (const v of resp.json.enrolledVehicleDetails) {
          if (v.vehicleDetails.vin === this.vin) {
            vehicle = v.vehicleDetails
            break
          }
        }
      }

      this.carVin = vehicle.vin
      this.carId = vehicle.regid
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
    if (this.config.debugLogging) this.logger.log(error)
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
        ? (status.evStatus.batteryFstChrgPower && status.evStatus.batteryFstChrgPower) > 0
          ? status.evStatus.batteryFstChrgPower
          : status.evStatus.batteryStndChrgPower
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
      twelveSoc: status.battery.batSoc ? status.battery.batSoc : 0,
      odometer: status.odometer ? status.odometer : 0,
    }
  }

  protected async getCarStatus(id: string, forceUpdate: boolean): Promise<BluelinkStatus> {
    const api = 'ac/v2/rcs/rvs/vehicleStatus'
    const resp = await this.request({
      url: this.apiDomain + api,
      headers: {
        ...this.carHeaders(),
        refresh: forceUpdate ? 'true' : 'false',
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

  // US implementation does not seem to have a mechanism to check for succesful commands or not
  // for now do nothing but return success until we get some logs and can work out what to do
  protected async pollForCommandCompletion(resp: {
    resp: Record<string, any>
    json: any
  }): Promise<{ isSuccess: boolean; data: any }> {
    return {
      isSuccess: true,
      data: resp.json,
    }
  }

  protected async lock(id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    return await this.lockUnlock(id, true)
  }

  protected async unlock(id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    return await this.lockUnlock(id, false)
  }

  protected async lockUnlock(_id: string, shouldLock: boolean): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const api = shouldLock ? '/ac/v2/rcs/rdo/off' : '/ac/v2/rcs/rdo/on'
    const resp = await this.request({
      url: this.apiDomain + api,
      method: 'POST',
      data: JSON.stringify({
        userName: this.config.auth.username,
        vin: this.cache.car.vin,
      }),
      headers: {
        ...this.carHeaders(),
        bluelinkservicepin: this.config.auth.pin,
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      return await this.pollForCommandCompletion(resp)
    }
    const error = `Failed to send lockUnlock command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async startCharge(id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    return await this.chargeStopCharge(id, true)
  }

  protected async stopCharge(id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    return await this.chargeStopCharge(id, false)
  }

  protected async chargeStopCharge(
    _id: string,
    shouldCharge: boolean,
  ): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const api = shouldCharge ? '/ac/v2/evc/charge/start' : '/ac/v2/evc/charge/stop'
    const resp = await this.request({
      url: this.apiDomain + api,
      method: 'POST',
      data: JSON.stringify({
        userName: this.config.auth.username,
        vin: this.cache.car.vin,
      }),
      headers: {
        ...this.carHeaders(),
        bluelinkservicepin: this.config.auth.pin,
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      return await this.pollForCommandCompletion(resp)
    }
    const error = `Failed to send charge command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async climateOn(
    _id: string,
    config: ClimateRequest,
  ): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    if (!this.tempLookup) {
      throw Error(`Mis-Configured sub-class - no temp lookup defined`)
    }
    const configTempIndex = this.config.tempType
    const tempIndex = this.tempLookup[configTempIndex].indexOf(config.temp)

    if (!tempIndex || tempIndex == -1) {
      throw Error(`Failed to convert temp ${config.temp} in climateOn command`)
    }

    const api = '/ac/v2/evc/fatc/start'
    const resp = await this.request({
      url: this.apiDomain + api,
      method: 'POST',
      data: JSON.stringify({
        airCtrl: 1,
        defrost: config.defrost,
        airTemp: {
          value: this.tempLookup.H[tempIndex],
          unit: 0,
          hvacTempType: 1,
        },
        igniOnDuration: config.durationMinutes,
        heating1: config.steering ? 4 : 0,
      }),
      headers: {
        ...this.carHeaders(),
        bluelinkservicepin: this.config.auth.pin,
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      return await this.pollForCommandCompletion(resp)
    }
    const error = `Failed to send climateOff command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async climateOff(_id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const api = '/ac/v2/evc/fatc/stop'
    const resp = await this.request({
      url: this.apiDomain + api,
      method: 'POST',
      headers: {
        ...this.carHeaders(),
        bluelinkservicepin: this.config.auth.pin,
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      return await this.pollForCommandCompletion(resp)
    }
    const error = `Failed to send climateOff command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }
}
