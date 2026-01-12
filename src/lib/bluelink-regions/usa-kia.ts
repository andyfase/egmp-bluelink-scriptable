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
import { isNotEmptyObject } from '../util'
import { textInput } from '../scriptable-utils/'
import { returnMockedCarStatus, returnMockedCar } from './mock'

const DEFAULT_API_DOMAIN = 'api.owners.kia.com'
const LOGIN_EXPIRY = 24 * 60 * 60 * 1000
const MOCK_API = false

interface MFAResponse {
  rmtoken: string
  sid?: string
}

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
      appVersion: '7.22.0',
      // clientuuid will be overridden from cache if exists
      clientuuid: UUID.string().toLocaleLowerCase(),
      clientId: 'SPACL716-APL',
      phonebrand: 'iPhone',
      osType: 'iOS',
      osVersion: '15.8.5',
      secretKey: 'sydnat-9kykci-Kuhtep-h5nK',
      to: 'APIGW',
      tokentype: 'A',
      'User-Agent': 'KIAPrimo_iOS/37 CFNetwork/1335.0.3.4 Darwin/21.6.0',
      // deviceId will be overridden from cache if exists
      deviceId: this.generateDeviceId(),
      Host: DEFAULT_API_DOMAIN,
    }

    this.authHeader = 'sid'
    this.authIdHeader = 'vinkey'
  }

  static async init(config: Config, refreshAuth: boolean, vin?: string, statusCheckInterval?: number) {
    const obj = new BluelinkUSAKia(config, statusCheckInterval)
    await obj.superInit(config, refreshAuth)
    return obj
  }

  protected generateDeviceId(): string {
    return `${this.genRanHex(22)}:${this.genRanHex(9)}_${this.genRanHex(10)}-${this.genRanHex(5)}_${this.genRanHex(22)}_${this.genRanHex(8)}-${this.genRanHex(18)}-_${this.genRanHex(22)}_${this.genRanHex(17)}`
  }

  protected getAdditionalHeaders(): Record<string, string> {
    // inject previous deviceId and clientuuid from cache if exists
    if (this.cache && this.cache.token.additionalTokens && this.cache.token.additionalTokens.deviceId) {
      this.additionalHeaders.deviceId = this.cache.token.additionalTokens.deviceId
    }
    if (this.cache && this.cache.token.additionalTokens && this.cache.token.additionalTokens.clientuuid) {
      this.additionalHeaders.clientuuid = this.cache.token.additionalTokens.clientuuid
    }
    return this.additionalHeaders
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

  protected async mfa(type: 'EMAIL' | 'SMS', code: string, xid: string): Promise<BluelinkTokens | undefined> {
    const mfaSendResp = await this.request({
      url: this.apiDomain + 'cmm/sendOTP',
      data: '{}',
      headers: {
        date: this.getDateString(),
        otpkey: code,
        notifytype: type,
        xid: xid,
      },
      noAuth: true,
      validResponseFunction: this.requestResponseValid,
    })
    if (!this.requestResponseValid(mfaSendResp.resp, mfaSendResp.json).valid) {
      const error = `MFA Send Failed: ${JSON.stringify(mfaSendResp.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      return undefined
    }

    // prompt user for code
    const mfaCode = await textInput(`MFA code sent via ${type.toLocaleLowerCase()}.`, {
      submitText: 'Enter Code',
      flavor: 'number',
    })

    if (!mfaCode) {
      //  user cancelled most likely
      if (this.config.debugLogging) this.logger.log(`MFA Verify Failed / Cancelled`)
      return undefined
    }

    if (this.config.debugLogging) this.logger.log(`MFA Code entered: ${mfaCode}`)
    if (mfaCode) {
      const mfaVerifyResp = await this.request({
        url: this.apiDomain + 'cmm/verifyOTP',
        data: JSON.stringify({ otp: mfaCode }),
        headers: {
          date: this.getDateString(),
          otpkey: code,
          xid: xid,
        },
        noAuth: true,
        validResponseFunction: this.requestResponseValid,
      })

      if (this.requestResponseValid(mfaVerifyResp.resp, mfaVerifyResp.json).valid) {
        return await this.login({
          rmtoken: this.caseInsensitiveParamExtraction('rmtoken', mfaVerifyResp.resp.headers) || '',
          sid: this.caseInsensitiveParamExtraction('sid', mfaVerifyResp.resp.headers) || '',
        })
      }

      const error = `MFA Verify Failed: ${JSON.stringify(mfaVerifyResp.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      return undefined
    }
  }

  protected async login(mfaToken: MFAResponse | undefined = undefined): Promise<BluelinkTokens | undefined> {
    /*
      Kia US Login/Refresh process requires initial MFA to extract SID.
      The rmtoken returned in the initial login appears to be long lived and can be used for subsequent logins without MFA,
      However to do that the deviceId and clientuuid used in the initial login must also be reused.
      Hence these are cached along with the rmtoken for future logins and used if exists in cache
    */
    // check for previous MFA token
    if (!mfaToken && this.cache && this.cache.token.additionalTokens && this.cache.token.additionalTokens.rmToken) {
      mfaToken = {
        rmtoken: this.cache.token.additionalTokens.rmToken,
      }
    }

    const resp = await this.request({
      url: this.apiDomain + 'prof/authUser',
      data: JSON.stringify({
        deviceKey: this.getAdditionalHeaders().deviceId,
        deviceType: 2,
        tncFlag: 1,
        userCredential: {
          userId: this.config.auth.username,
          password: this.config.auth.password,
        },
      }),
      headers: {
        date: this.getDateString(),
        ...(mfaToken &&
          mfaToken.rmtoken && {
            rmtoken: mfaToken.rmtoken,
          }),
        ...(mfaToken &&
          mfaToken.sid && {
            sid: mfaToken.sid,
          }),
      },
      noAuth: true,
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      const sid = this.caseInsensitiveParamExtraction('sid', resp.resp.headers)
      const xid = this.caseInsensitiveParamExtraction('xid', resp.resp.headers)
      if (!sid && xid && (!mfaToken || !mfaToken.sid)) {
        // If no SID and we havent attempted MFA yet - try it, loging will be called again from MFA function
        return await this.mfa(
          resp.json.payload.phoneVerifyStatus && this.config.mfaPreference === 'sms' ? 'SMS' : 'EMAIL',
          resp.json.payload.otpKey,
          xid,
        )
      }

      // update tokens used in this session as we call getCar before we write the new tokens to cache
      this.tokens = {
        accessToken: sid || '',
        refreshToken: '', // seemingly KIA us doesnt support refresh?
        expiry: Math.floor(Date.now() / 1000) + Number(LOGIN_EXPIRY), // we also dont get an expiry?
        ...(mfaToken && {
          additionalTokens: {
            rmToken: mfaToken.rmtoken,
            deviceId: this.getAdditionalHeaders().deviceId || '',
            clientuuid: this.getAdditionalHeaders().clientuuid || '',
          },
        }),
      }
      const car = await this.getCar(true)
      if (car) this.tokens.authId = car.id
      return this.tokens
    }

    // if we reach here login failed - regenerate deviceId if we have it cached
    if (
      this.cache &&
      this.cache.token &&
      this.cache.token.additionalTokens &&
      this.cache.token.additionalTokens.deviceId
    ) {
      this.cache.token.additionalTokens.deviceId = this.generateDeviceId()
      this.cache.token.additionalTokens.clientuuid = UUID.string().toLocaleLowerCase()
      this.saveCache()
    }

    const error = `Login Failed: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    return undefined
  }

  protected async getCar(noRetry = false): Promise<BluelinkCar | undefined> {
    if (MOCK_API) return returnMockedCar()
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

    if (!this.requestResponseValid(resp.resp, resp.json).valid) {
      const error = `Failed to retrieve vehicles: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    // if multiple cars and we have no vin populate options and return undefined for user selection
    if (this.requestResponseValid(resp.resp, resp.json).valid && resp.json.payload.vehicleSummary.length > 1 && !vin) {
      for (const vehicle of resp.json.payload.vehicleSummary) {
        this.carOptions.push({
          vin: vehicle.vin,
          nickName: vehicle.nickName,
          modelName: vehicle.modelName,
          modelYear: vehicle.modelYear,
        })
      }
      return undefined
    }

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

    if (!status.evStatus) return this.defaultNoEVStatus(lastRemoteCheck, status, false, undefined, undefined, location)

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
    location: boolean = false,
    retry = true,
  ): Promise<BluelinkStatus> {
    if (MOCK_API) return returnMockedCarStatus()
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
            location: location ? '1' : '0',
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
        if (location && resp.json.payload.vehicleInfoList[0].lastVehicleInfo.location) {
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
        return await this.getCarStatus(_id, forceUpdate, location, false)
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
        ? await this.getCarStatus(_id, false, true)
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

  private seatSettings(level: number): { heatVentType: number; heatVentLevel: number; heatVentStep: number } {
    switch (level) {
      case 8: // High heat
        return { heatVentType: 1, heatVentLevel: 4, heatVentStep: 1 }
      case 7: // Medium heat
        return { heatVentType: 1, heatVentLevel: 3, heatVentStep: 2 }
      case 6: // Low heat
        return { heatVentType: 1, heatVentLevel: 2, heatVentStep: 3 }
      case 5: // High cool
        return { heatVentType: 2, heatVentLevel: 4, heatVentStep: 1 }
      case 4: // Medium cool
        return { heatVentType: 2, heatVentLevel: 3, heatVentStep: 2 }
      case 3: // Low cool
        return { heatVentType: 2, heatVentLevel: 2, heatVentStep: 3 }
      case 1: // Generically on, assume high heat
        return { heatVentType: 1, heatVentLevel: 4, heatVentStep: 1 }
      default: // Off
        return { heatVentType: 0, heatVentLevel: 1, heatVentStep: 0 }
    }
  }

  protected async climateOn(
    id: string,
    config: ClimateRequest,
    retryWithNoSeat = false,
  ): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
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
          ...(config.seatClimateOption &&
            isNotEmptyObject(config.seatClimateOption) &&
            !retryWithNoSeat && {
              heatVentSeat: {
                driverSeat: this.seatSettings(config.seatClimateOption.driver),
                passengerSeat: this.seatSettings(config.seatClimateOption.passenger),
                rearLeftSeat: this.seatSettings(config.seatClimateOption.rearLeft),
                rearRightSeat: this.seatSettings(config.seatClimateOption.rearRight),
              },
            }),
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
    } else {
      // Kia/Hyundai US seems pretty particular with seat settings, hence if fail retry without them,
      if (!retryWithNoSeat) return this.climateOn(id, config, true)
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
