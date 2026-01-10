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
import { isNotEmptyObject } from '../util'

const DEFAULT_API_DOMAIN = 'mybluelink.ca'
const API_DOMAINS: Record<string, string> = {
  hyundai: 'mybluelink.ca',
  kia: 'kiaconnect.ca',
  genesis: 'genesisconnect.ca',
}

export class BluelinkCanada extends Bluelink {
  constructor(config: Config, statusCheckInterval?: number) {
    super(config)
    this.distanceUnit = 'km'
    this.apiHost = config.manufacturer
      ? this.getApiDomain(config.manufacturer, API_DOMAINS, DEFAULT_API_DOMAIN)
      : DEFAULT_API_DOMAIN
    this.apiDomain = `https://${this.apiHost}/tods/api/`
    this.statusCheckInterval = statusCheckInterval || DEFAULT_STATUS_CHECK_INTERVAL
    this.additionalHeaders = {
      deviceid: UUID.string(), // native scriptable UUID method
      from: config.manufacturer === 'hyundai' ? 'SPA' : 'CWP',
      client_id: 'HATAHSPACA0232141ED9722C67715A0B',
      client_secret: 'CLISCR01AHSPA',
      language: '0',
      // brand: this.apiHost === 'mybluelink.ca' ? 'H' : 'kia', // seems to be ignored by API
      offset: this.getTimeZone().slice(0, 3),
      'User-Agent':
        config.manufacturer === 'hyundai'
          ? 'MyHyundai/2.0.25 (iPhone; iOS 18.3; Scale/3.00)'
          : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
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

  static async init(config: Config, refreshAuth: boolean, vin?: string, statusCheckInterval?: number) {
    const obj = new BluelinkCanada(config, statusCheckInterval)
    await obj.superInit(config, refreshAuth)
    return obj
  }

  private requestResponseValid(
    resp: Record<string, any>,
    payload: Record<string, any>,
  ): { valid: boolean; retry: boolean } {
    if (Object.hasOwn(payload, 'responseHeader') && payload.responseHeader.responseCode == 0) {
      return { valid: true, retry: false }
    }
    if (Object.hasOwn(payload, 'responseHeader') && payload.responseHeader.responseCode == 1) {
      // check failure
      if (
        Object.hasOwn(payload, 'error') &&
        Object.hasOwn(payload.error, 'errorDesc') &&
        (payload.error.errorDesc.toLocaleString().includes('expired') ||
          payload.error.errorDesc.toLocaleString().includes('deleted') ||
          payload.error.errorDesc.toLocaleString().includes('ip validation'))
      ) {
        return { valid: false, retry: true }
      }
    }
    return { valid: false, retry: false }
  }

  protected async getSessionCookie(): Promise<string> {
    const req = new Request(`https://${this.apiHost}/login`)
    req.headers = this.getAdditionalHeaders()
    req.method = 'GET'
    await req.load()
    if (req.response.cookies) {
      for (const cookie of req.response.cookies) {
        if (cookie.name.toLowerCase() === '__cf_bm') {
          return `__cf_bm=${cookie.value}`
        }
      }
    }
    return ''
  }

  protected async login(): Promise<BluelinkTokens | undefined> {
    // get cookie
    const cookieValue = await this.getSessionCookie()
    const resp = await this.request({
      url: this.apiDomain + 'v2/login',
      data: JSON.stringify({
        loginId: this.config.auth.username,
        password: this.config.auth.password,
      }),
      headers: {
        Cookie: cookieValue,
      },
      noAuth: true,
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      return {
        accessToken: resp.json.result.token.accessToken,
        expiry: Math.floor(Date.now() / 1000) + Number(resp.json.result.token.expireIn), // we only get a expireIn not a actual date
        authCookie: cookieValue,
      }
    }

    const error = `Login Failed: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    return undefined
  }

  protected async setCar(id: string) {
    const resp = await this.request({
      url: this.apiDomain + 'vhcllst',
      data: JSON.stringify({
        vehicleId: id,
      }),
      validResponseFunction: this.requestResponseValid,
    })
    if (!this.requestResponseValid(resp.resp, resp.json).valid) {
      const error = `Failed to set car ${id}: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }
  }

  protected async getCar(): Promise<BluelinkCar | undefined> {
    let vin = this.vin
    if (!vin && this.cache) {
      vin = this.cache.car.vin
    }

    const resp = await this.request({
      url: this.apiDomain + 'vhcllst',
      method: 'POST',
      validResponseFunction: this.requestResponseValid,
    })

    if (!this.requestResponseValid(resp.resp, resp.json).valid) {
      const error = `Failed to retrieve vehicles: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    // if multuple cars and we have no vin populate options and return undefined for user selection
    if (this.requestResponseValid(resp.resp, resp.json).valid && resp.json.result.vehicles.length > 1 && !vin) {
      for (const vehicle of resp.json.result.vehicles) {
        this.carOptions.push({
          vin: vehicle.vin,
          nickName: vehicle.nickName,
          modelName: vehicle.modelName,
          modelYear: vehicle.modelYear,
        })
      }
      return undefined
    }

    if (this.requestResponseValid(resp.resp, resp.json).valid && resp.json.result.vehicles.length > 0) {
      let vehicle = resp.json.result.vehicles[0]
      if (vin) {
        for (const v of resp.json.result.vehicles) {
          if (v.vin === vin) {
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
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected returnCarStatus(
    status: any,
    forceUpdate: boolean,
    odometer?: number,
    chargeLimit?: ChargeLimit,
    location?: Location,
  ): BluelinkStatus {
    const lastRemoteCheckString = status.lastStatusDate + 'Z'
    const df = new DateFormatter()
    df.dateFormat = 'yyyyMMddHHmmssZ'
    const lastRemoteCheck = df.date(lastRemoteCheckString)

    // For whatever reason sometimes the status will not have the evStatus object
    // deal with that with either cached or zero values
    if (!status.evStatus)
      return this.defaultNoEVStatus(lastRemoteCheck, status, forceUpdate, odometer, chargeLimit, location)

    // deal with charging speed - JSON response if variable / inconsistent - hence check for various objects
    let chargingPower = 0
    let isCharging = false
    if (status.evStatus.batteryCharge) {
      isCharging = true
      if (status.evStatus.batteryPower) {
        if (status.evStatus.batteryPower.batteryFstChrgPower && status.evStatus.batteryPower.batteryFstChrgPower > 0) {
          chargingPower = status.evStatus.batteryPower.batteryFstChrgPower
        } else if (
          status.evStatus.batteryPower.batteryStndChrgPower &&
          status.evStatus.batteryPower.batteryStndChrgPower > 0
        ) {
          chargingPower = status.evStatus.batteryPower.batteryStndChrgPower
        } else {
          // should never get here - log failure to get charging power
          this.logger.log(`Failed to get charging power - ${JSON.stringify(status.evStatus.batteryPower)}`)
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
      twelveSoc: status.battery && status.battery.batSoc ? status.battery.batSoc : 0,
      odometer: odometer ? odometer : this.cache ? this.cache.status.odometer : 0,
      location: location ? location : this.cache ? this.cache.status.location : undefined,
      chargeLimit:
        chargeLimit && chargeLimit.acPercent > 0 ? chargeLimit : this.cache ? this.cache.status.chargeLimit : undefined,
    }
  }

  protected async getCarStatus(id: string, forceUpdate: boolean, location: boolean = false): Promise<BluelinkStatus> {
    const api = forceUpdate ? 'rltmvhclsts' : 'sltvhcl'
    const status = await this.request({
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
      validResponseFunction: this.requestResponseValid,
    })

    if (!this.requestResponseValid(status.resp, status.json).valid) {
      const error = `Failed to retrieve vehicle status: ${JSON.stringify(status.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    let chargeLimitStatus = undefined
    let locationStatus = undefined
    if (forceUpdate) chargeLimitStatus = await this.getChargeLimit(id)
    if (location) locationStatus = await this.getLocation(id)

    return this.returnCarStatus(
      status.json.result.status,
      forceUpdate,
      forceUpdate ? status.json.result.status.odometer : status.json.result.vehicle.odometer,
      chargeLimitStatus,
      locationStatus,
    )
  }

  protected async getAuthCode(): Promise<string> {
    const api = 'vrfypin'
    const resp = await this.request({
      url: this.apiDomain + api,
      method: 'POST',
      data: JSON.stringify({
        pin: this.config.auth.pin,
      }),
      validResponseFunction: this.requestResponseValid,
      headers: {},
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      return resp.json.result.pAuth
    }
    const error = `Failed to get auth code: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async pollForCommandCompletion(
    id: string,
    authCode: string,
    transactionId: string,
    chargeLimit?: ChargeLimit,
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
        validResponseFunction: this.requestResponseValid,
      })

      if (!this.requestResponseValid(resp.resp, resp.json).valid) {
        const error = `Failed to poll for command completion: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
        if (this.config.debugLogging) this.logger.log(error)
        throw Error(error)
      }

      if (resp.json.result.transaction.apiResult === 'C') {
        // update saved cache status
        if (resp.json.result.vehicle) {
          if (!chargeLimit) chargeLimit = await this.getChargeLimit(id)
          this.cache.status = this.returnCarStatus(resp.json.result.vehicle, true, undefined, chargeLimit)
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
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = this.caseInsensitiveParamExtraction('transactionid', resp.resp.headers)
      if (transactionId) return await this.pollForCommandCompletion(id, authCode, transactionId)
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
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = this.caseInsensitiveParamExtraction('transactionid', resp.resp.headers)
      if (transactionId) return await this.pollForCommandCompletion(id, authCode, transactionId)
    }
    const error = `Failed to send charge command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async climateOn(
    id: string,
    config: ClimateRequest,
    newPayloadType = false,
  ): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    if (!this.tempLookup) {
      throw Error(`Mis-Configured sub-class - no temp lookup defined`)
    }
    const configTempIndex = this.config.tempType
    const tempIndex = this.tempLookup[configTempIndex].indexOf(config.temp)

    if (tempIndex === undefined || tempIndex == -1) {
      throw Error(`Failed to convert temp ${config.temp} in climateOn command`)
    }

    // More modern Canaidan vehicles use a different payload attribute
    // Kia EV9 uses remoteControl instead of hvacInfo
    // rather than whitelist to detect this we just retry on failure with the new key
    // in the future we can default to the new payload key
    const authCode = await this.getAuthCode()
    const api = 'evc/rfon'
    const resp = await this.request({
      url: this.apiDomain + api,
      method: 'POST',
      data: JSON.stringify({
        pin: this.config.auth.pin,
        [newPayloadType ? 'remoteControl' : 'hvacInfo']: {
          airCtrl: 1,
          defrost: config.frontDefrost,
          airTemp: {
            value: this.tempLookup.H[tempIndex],
            unit: 0,
            hvacTempType: 1,
          },
          igniOnDuration: config.durationMinutes,
          heating1: this.getHeatingValue(config.rearDefrost, config.steering),
          ...(config.seatClimateOption &&
            isNotEmptyObject(config.seatClimateOption) && {
              seatHeaterVentCMD: {
                drvSeatOptCmd: config.seatClimateOption.driver,
                astSeatOptCmd: config.seatClimateOption.passenger,
                rlSeatOptCmd: config.seatClimateOption.rearLeft,
                rrSeatOptCmd: config.seatClimateOption.rearRight,
              },
            }),
        },
      }),
      headers: {
        Vehicleid: id,
        Pauth: authCode,
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = this.caseInsensitiveParamExtraction('transactionid', resp.resp.headers)
      if (transactionId) return await this.pollForCommandCompletion(id, authCode, transactionId)
    }
    const error = `Failed to send climateOff command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)

    // retry with new payload type if needed
    if (!newPayloadType) return await this.climateOn(id, config, true)
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
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = this.caseInsensitiveParamExtraction('transactionid', resp.resp.headers)
      if (transactionId) return await this.pollForCommandCompletion(id, authCode, transactionId)
    }
    const error = `Failed to send climateOff command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async getLocation(id: string): Promise<Location | undefined> {
    const api = 'fndmcr'
    const authCode = await this.getAuthCode()
    const resp = await this.request({
      method: 'POST',
      url: this.apiDomain + api,
      data: JSON.stringify({
        pin: this.config.auth.pin,
      }),
      headers: {
        Vehicleid: id,
        Pauth: authCode,
      },
      validResponseFunction: this.requestResponseValid,
    })

    // default to zero if we cant extract
    if (this.requestResponseValid(resp.resp, resp.json).valid && resp.json.result) {
      return {
        latitude: resp.json.result.coord.lat,
        longitude: resp.json.result.coord.lon,
      } as Location
    }
    return undefined
  }

  protected async getChargeLimit(id: string): Promise<ChargeLimit> {
    const api = 'evc/selsoc'
    const resp = await this.request({
      method: 'POST',
      url: this.apiDomain + api,
      headers: {
        Vehicleid: id,
      },
      validResponseFunction: this.requestResponseValid,
    })
    const chargeLimit = {
      dcPercent: 0,
      acPercent: 0,
    }
    if (this.requestResponseValid(resp.resp, resp.json).valid && resp.json.result) {
      for (const soc of resp.json.result) {
        if (soc.plugType === 0) {
          chargeLimit.dcPercent = soc.level
        } else if (soc.plugType === 1) {
          chargeLimit.acPercent = soc.level
        }
      }
    }
    // default to zero if we cant extract
    return chargeLimit
  }

  protected async setChargeLimit(
    id: string,
    config: ChargeLimit,
  ): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const authCode = await this.getAuthCode()
    const api = 'evc/setsoc'
    const resp = await this.request({
      url: this.apiDomain + api,
      method: 'POST',
      data: JSON.stringify({
        pin: this.config.auth.pin,
        tsoc: [
          {
            plugType: 0,
            level: config.dcPercent,
          },
          {
            plugType: 1,
            level: config.acPercent,
          },
        ],
      }),
      headers: {
        Vehicleid: id,
        Pauth: authCode,
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = this.caseInsensitiveParamExtraction('transactionid', resp.resp.headers)
      if (transactionId) return await this.pollForCommandCompletion(id, authCode, transactionId, config)
    }
    const error = `Failed to send chargeLimit command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }
}
