import {
  Bluelink,
  BluelinkTokens,
  BluelinkCar,
  BluelinkStatus,
  ClimateRequest,
  ChargeLimit,
  Location,
  DEFAULT_STATUS_CHECK_INTERVAL,
  MAX_COMPLETION_POLLS,
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
      offset: this.getTimeZone().slice(0, 3),
      client_id:
        config.manufacturer && config.manufacturer === 'kia' ? 'MWAMOBILE' : 'm66129Bb-em93-SPAHYN-bZ91-am4540zp19920',
      clientSecret:
        config.manufacturer && config.manufacturer === 'kia' ? '98er-w34rf-ibf3-3f6h' : 'v558o935-6nne-423i-baa8',
      username: this.config.auth.username,
      blueLinkServicePin: `${this.config.auth.pin}`,
      brandIndicator: 'H',
      'User-Agent': 'okhttp/3.14.9',
    }

    this.authHeader = 'accessToken'
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
      VIN: this.cache ? this.cache.car.vin : this.carVin!,
      'APPCLOUD-VIN': this.cache ? this.cache.car.vin : this.carVin!,
      // Seemingly 2025 cars need to have a gen set to '3'
      gen: this.cache && this.cache.car ? (Number(this.cache.car.modelYear) >= 2025 ? '3' : '2') : '2',
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
    let vin = this.vin
    if (!vin && this.cache) {
      vin = this.cache.car.vin
    }

    const resp = await this.request({
      url: this.apiDomain + `ac/v2/enrollment/details/${this.config.auth.username}`,
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid && resp.json.enrolledVehicleDetails.length > 0) {
      let vehicle = resp.json.enrolledVehicleDetails[0].vehicleDetails
      if (vin) {
        for (const v of resp.json.enrolledVehicleDetails) {
          if (v.vehicleDetails.vin === vin) {
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

  protected returnCarStatus(status: any, forceUpdate: boolean, location?: Location): BluelinkStatus {
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

    // check for charge limits
    const chargeLimit: ChargeLimit = {
      dcPercent: 0,
      acPercent: 0,
    }
    if (status.evStatus.reservChargeInfos && status.evStatus.reservChargeInfos.targetSOClist) {
      for (const limit of status.evStatus.reservChargeInfos.targetSOClist) {
        if (limit.plugType === 0) {
          chargeLimit.dcPercent = limit.targetSOClevel
        } else if (limit.plugType === 1) {
          chargeLimit.acPercent = limit.targetSOClevel
        }
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
      location: location ? location : this.cache ? this.cache.status.location : undefined,
      chargeLimit:
        chargeLimit && chargeLimit.acPercent > 0 ? chargeLimit : this.cache ? this.cache.status.chargeLimit : undefined,
    }
  }

  protected async getCarStatus(id: string, forceUpdate: boolean, location: boolean = false): Promise<BluelinkStatus> {
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
      let locationStatus = undefined
      if (location) locationStatus = await this.getLocation(id)
      return this.returnCarStatus(resp.json.vehicleStatus, forceUpdate, locationStatus)
    }

    const error = `Failed to retrieve vehicle status: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  // US implementation does not seem to have a mechanism to check for succesful commands or not
  // for now do nothing but return success until we get some logs and can work out what to do
  protected async pollForCommandCompletion(
    resp: {
      resp: Record<string, any>
      json: any
    },
    transactionId: string,
  ): Promise<{ isSuccess: boolean; data: any }> {
    const api = 'ac/v2/rmt/getRunningStatus'
    let attempts = 0
    while (attempts <= MAX_COMPLETION_POLLS) {
      const resp = await this.request({
        url: this.apiDomain + api,
        headers: {
          ...this.carHeaders(),
          tid: transactionId,
          login_id: this.config.auth.username,
          service_type: 'REMOTE_POLL', // Note this value is made up - the header needs to exist but the value does not appear to matter. Valid values so far are REMOTE_LOCK, REMOTE_CLIMATE_STOP
        },
        validResponseFunction: this.requestResponseValid,
      })

      if (
        !this.requestResponseValid(resp.resp, resp.json).valid ||
        (resp.json.status && resp.json.status === 'ERROR')
      ) {
        const error = `Failed to poll for command completion: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
        if (this.config.debugLogging) this.logger.log(error)
        throw Error(error)
      }

      if (resp.json.status === 'SUCCESS') {
        // fetch status from API as we dont get it in response.
        const status = await this.getCarStatus(this.cache.car.id, false)
        this.cache.status = status
        this.saveCache()
        if (this.config.debugLogging) this.logger.log(`Return poll success!! ${JSON.stringify(this.cache.status)}`)
        return {
          isSuccess: true,
          data: this.cache.status,
        }
      }
      attempts += 1
      await this.sleep(4000)
    }
    if (this.config.debugLogging) this.logger.log(`Return poll failure!! -  last response ${JSON.stringify(resp.json)}`)
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

  protected async lockUnlock(_id: string, shouldLock: boolean): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const api = shouldLock ? 'ac/v2/rcs/rdo/off' : 'ac/v2/rcs/rdo/on'

    const resp = await this.request({
      url: this.apiDomain + api,
      method: 'POST',
      data: JSON.stringify({
        userName: this.config.auth.username,
        vin: this.cache.car.vin,
      }),
      headers: {
        ...this.carHeaders(),
      },
      notJSON: true,
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = this.caseInsensitiveParamExtraction('tmsTid', resp.resp.headers)
      if (transactionId) return await this.pollForCommandCompletion(resp, transactionId)
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
    const api = shouldCharge ? 'ac/v2/evc/charge/start' : 'ac/v2/evc/charge/stop'
    const resp = await this.request({
      url: this.apiDomain + api,
      method: 'POST',
      data: JSON.stringify({
        userName: this.config.auth.username,
        vin: this.cache.car.vin,
      }),
      notJSON: true,
      headers: {
        ...this.carHeaders(),
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = this.caseInsensitiveParamExtraction('tmsTid', resp.resp.headers)
      if (transactionId) return await this.pollForCommandCompletion(resp, transactionId)
    }
    const error = `Failed to send charge command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async climateOn(
    _id: string,
    config: ClimateRequest,
  ): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const api = 'ac/v2/evc/fatc/start'
    const resp = await this.request({
      url: this.apiDomain + api,
      method: 'POST',
      data: JSON.stringify({
        airCtrl: 1,
        defrost: config.frontDefrost,
        airTemp: {
          value: config.temp.toString(),
          unit: this.config.tempType === 'F' ? 1 : 0,
        },
        // igniOnDuration: config.durationMinutes, // not supported in US
        heating1: this.getHeatingValue(config.rearDefrost, config.steering),
      }),
      notJSON: true,
      headers: {
        ...this.carHeaders(),
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = this.caseInsensitiveParamExtraction('tmsTid', resp.resp.headers)
      if (transactionId) return await this.pollForCommandCompletion(resp, transactionId)
    }
    const error = `Failed to send climateOn command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async climateOff(_id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const api = 'ac/v2/evc/fatc/stop'
    const resp = await this.request({
      url: this.apiDomain + api,
      method: 'POST',
      headers: {
        ...this.carHeaders(),
      },
      notJSON: true,
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = this.caseInsensitiveParamExtraction('tmsTid', resp.resp.headers)
      if (transactionId) return await this.pollForCommandCompletion(resp, transactionId)
    }
    const error = `Failed to send climateOff command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async setChargeLimit(
    _id: string,
    config: ChargeLimit,
  ): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const api = 'evc/charge/targetsoc/set'
    const resp = await this.request({
      url: this.apiDomain + api,
      method: 'POST',
      data: JSON.stringify({
        targetSOClist: [
          {
            plugType: 0,
            targetSOClevel: config.dcPercent,
          },
          {
            plugType: 1,
            targetSOClevel: config.acPercent,
          },
        ],
      }),
      notJSON: true,
      headers: {
        ...this.carHeaders(),
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = this.caseInsensitiveParamExtraction('tmsTid', resp.resp.headers)
      if (transactionId) return await this.pollForCommandCompletion(resp, transactionId)
    }
    const error = `Failed to send chargeLimit command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async getLocation(_id: string): Promise<Location | undefined> {
    const api = 'ac/v2/rcs/rfc/findMyCar'
    const resp = await this.request({
      url: this.apiDomain + api,
      headers: {
        ...this.carHeaders(),
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid && resp.json.coord) {
      return {
        latitude: resp.json.coord.lat,
        longitude: resp.json.coord.lon,
      } as Location
    }
    return undefined
  }
}
