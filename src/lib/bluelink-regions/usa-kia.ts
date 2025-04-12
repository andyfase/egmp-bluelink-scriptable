import {
  Bluelink,
  BluelinkTokens,
  BluelinkCar,
  BluelinkStatus,
  ClimateRequest,
  DEFAULT_STATUS_CHECK_INTERVAL,
  MAX_COMPLETION_POLLS,
  ChargeLimit,
  Location,
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
    this.authIdHeader = 'vinkey'
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
      // update tokens used in this session as we call getCar before we write the new tokens to cache
      this.tokens = {
        accessToken: this.caseInsensitiveParamExtraction('sid', resp.resp.headers) || '',
        refreshToken: '', // seemingly KIA us doesnt support refresh?
        expiry: Math.floor(Date.now() / 1000) + Number(LOGIN_EXPIRY), // we also dont get an expiry?
      }
      this.tokens.authId = (await this.getCar(true)).id
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
          if (v.vin === vin) {
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

  protected returnCarStatus(status: any, location?: Location): BluelinkStatus {
    const lastRemoteCheckString = status.syncDate.utc + 'Z'
    const df = new DateFormatter()
    df.dateFormat = 'yyyyMMddHHmmssZ'
    const lastRemoteCheck = df.date(lastRemoteCheckString)

    // check for charge limits
    const chargeLimit: ChargeLimit = {
      dcPercent: 0,
      acPercent: 0,
    }
    if (status.evStatus.targetSOC) {
      for (const limit of status.evStatus.targetSOC) {
        if (limit.plugType === 0) {
          chargeLimit.dcPercent = limit.targetSOClevel
        } else if (limit.plugType === 1) {
          chargeLimit.acPercent = limit.targetSOClevel
        }
      }
    }

    return {
      lastStatusCheck: Date.now(),
      lastRemoteStatusCheck: lastRemoteCheck.getTime(),
      isCharging: status.evStatus.batteryCharge,
      isPluggedIn: status.evStatus.batteryPlugin > 0 ? true : false,
      chargingPower: status.evStatus.batteryCharge ? status.evStatus.realTimePower : 0,
      remainingChargeTimeMins: status.evStatus.remainChargeTime[0].timeInterval.value,
      // sometimes range back as zero? if so ignore and use cache
      range:
        status.evStatus.drvDistance[0].rangeByFuel.evModeRange.value > 0
          ? Math.floor(status.evStatus.drvDistance[0].rangeByFuel.evModeRange.value)
          : this.cache
            ? this.cache.status.range
            : 0,
      locked: status.doorLock,
      climate: status.climate.airCtrl,
      soc: status.evStatus.batteryStatus,
      twelveSoc: status.batteryStatus.stateOfCharge ? status.batteryStatus.stateOfCharge : 0,
      odometer: 0, // not given in status
      location: location ? location : this.cache ? this.cache.status.location : undefined,
      chargeLimit:
        chargeLimit && chargeLimit.acPercent > 0 ? chargeLimit : this.cache ? this.cache.status.chargeLimit : undefined,
    }
  }

  protected async getCarStatus(
    _id: string,
    forceUpdate: boolean,
    _location: boolean = false,
    retry = true,
  ): Promise<BluelinkStatus> {
    if (!forceUpdate) {
      // as the request payload contains the authId - which is a auth param we disable retry and manage retry ourselves
      const resp = await this.request({
        url: this.apiDomain + 'cmm/gvi',
        noRetry: true,
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
            location: '1',
            vehicleStatus: '1',
            weather: '0',
          },
          // handle cache existing or not - this is normally hidden in base class but need to hanle here as auth param used in payload
          vinKey: [this.tokens ? this.tokens.authId : this.cache.token.authId],
        }),
        headers: {
          date: this.getDateString(),
        },
        validResponseFunction: this.requestResponseValid,
      })

      if (this.requestResponseValid(resp.resp, resp.json).valid) {
        let locationStatus = undefined
        if (resp.json.payload.vehicleInfoList[0].lastVehicleInfo.location) {
          locationStatus = {
            latitude: resp.json.payload.vehicleInfoList[0].lastVehicleInfo.location.coord.lat,
            longitude: resp.json.payload.vehicleInfoList[0].lastVehicleInfo.location.coord.lon,
          } as Location
        }
        return this.returnCarStatus(
          resp.json.payload.vehicleInfoList[0].lastVehicleInfo.vehicleStatusRpt.vehicleStatus,
          locationStatus,
        )
      } else if (retry) {
        // manage retry ourselves - just assume we need to re-auth
        await this.refreshLogin(true)
        return await this.getCarStatus(_id, forceUpdate, _location, false)
      }
      const error = `Failed to retrieve vehicle status: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    const resp = await this.request({
      url: this.apiDomain + 'rems/rvs',
      data: JSON.stringify({
        requestType: 0,
      }),
      headers: {
        date: this.getDateString(),
      },
      validResponseFunction: this.requestResponseValid,
    })

    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      // only cached data contains latest location so return cached API after remote command
      return location
        ? await this.getCarStatus(_id, false)
        : this.returnCarStatus(resp.json.payload.vehicleStatusRpt.vehicleStatus)
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
    while (attempts <= MAX_COMPLETION_POLLS) {
      const resp = await this.request({
        url: this.apiDomain + 'cmm/gts',
        data: JSON.stringify({
          xid: transactionId,
        }),
        headers: {
          date: this.getDateString(),
        },
        validResponseFunction: this.requestResponseValid,
      })

      if (!this.requestResponseValid(resp.resp, resp.json).valid) {
        const error = `Failed to poll for command completion: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
        if (this.config.debugLogging) this.logger.log(error)
        throw Error(error)
      }

      // JSON payload looks like the below
      // Assumption is the command completed successfully if everything is zero, 1 means still going and 2 means failure?
      // At this point thats just a wild guess
      //
      // "payload": {
      //   "remoteStatus": 1,
      //   "calSyncStatus": 0,
      //   "alertStatus": 0,
      //   "locationStatus": 0,
      //   "evStatus": 0
      // }
      let complete = true
      for (const [k, v] of Object.entries(resp.json.payload)) {
        if (Number(v) === 1) {
          complete = false
        } else if (Number(v) > 1) {
          return {
            isSuccess: false,
            data: `${k} returned above 1 status: ${v}`,
          }
        }
      }
      if (complete) {
        return {
          isSuccess: true,
          data: (await this.getStatus(true, true)).status, // do force update to get latest data after command success
        }
      }
      attempts += 1
      await this.sleep(2000)
    }
    return {
      isSuccess: false,
      data: 'timeout on command completion',
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
        'Content-Type': 'application/json', // mandatory Content-Type on GET calls is mind-blowing bad!!!
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = this.caseInsensitiveParamExtraction('Xid', resp.resp.headers)
      if (transactionId) return await this.pollForCommandCompletion(id, transactionId)
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
    const api = shouldCharge ? 'evc/charge' : 'evc/cancel'
    const resp = await this.request({
      url: this.apiDomain + api,
      method: 'GET',
      ...(shouldCharge && {
        data: JSON.stringify({
          chargeRatio: 100,
        }),
      }),
      headers: {
        date: this.getDateString(),
        ...(!shouldCharge && {
          'Content-Type': 'application/json', // mandatory Content-Type on GET calls is mind-blowing bad!!!
        }),
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = this.caseInsensitiveParamExtraction('Xid', resp.resp.headers)
      if (transactionId) return await this.pollForCommandCompletion(id, transactionId)
    }
    const error = `Failed to send chargeStartStop command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async climateOn(id: string, config: ClimateRequest): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const api = 'rems/start'
    const resp = await this.request({
      url: this.apiDomain + api,
      data: JSON.stringify({
        remoteClimate: {
          airCtrl: true,
          defrost: config.frontDefrost,
          airTemp: {
            value: config.temp.toString(),
            unit: this.config.tempType === 'F' ? 1 : 0,
          },
          ignitionOnDuration: {
            unit: 4,
            value: config.durationMinutes,
          },
          heatingAccessory: {
            steeringWheel: Number(config.steering),
            rearWindow: Number(config.rearDefrost),
            sideMirror: Number(config.rearDefrost),
          },
        },
      }),
      headers: {
        date: this.getDateString(),
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = this.caseInsensitiveParamExtraction('Xid', resp.resp.headers)
      if (transactionId) return await this.pollForCommandCompletion(id, transactionId)
    }
    const error = `Failed to send climateOn command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async climateOff(id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const resp = await this.request({
      url: this.apiDomain + 'rems/stop',
      headers: {
        date: this.getDateString(),
        'Content-Type': 'application/json', // mandatory Content-Type on GET calls is mind-blowing bad!!!
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = this.caseInsensitiveParamExtraction('Xid', resp.resp.headers)
      if (transactionId) return await this.pollForCommandCompletion(id, transactionId)
    }
    const error = `Failed to send climateOff command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async setChargeLimit(
    id: string,
    config: ChargeLimit,
  ): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const api = 'evc/sts'
    const resp = await this.request({
      url: this.apiDomain + api,
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
      headers: {
        date: this.getDateString(),
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = this.caseInsensitiveParamExtraction('Xid', resp.resp.headers)
      if (transactionId) return await this.pollForCommandCompletion(id, transactionId)
    }
    const error = `Failed to send chargeLimit command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }
}
