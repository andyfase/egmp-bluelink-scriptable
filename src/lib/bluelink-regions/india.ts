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
import { Buffer } from 'buffer'
import Url from 'url'

const b64decode = (str: string): string => Buffer.from(str, 'base64').toString('binary')
// const b64encode = (str: string): string => Buffer.from(str, 'binary').toString('base64')

interface ControlToken {
  expiry: number
  token: string
}

interface APIConfig {
  apiDomain: string
  apiPort: number
  ccspServiceId: string
  appId: string
  authCfb: string
  authBasic: string
  authHost: string
  authParam: string
  clientId: string
  authClientID: string
  pushType: string
}

const API_CONFIG: Record<string, APIConfig> = {
  hyundai: {
    apiDomain: 'prd.in-ccapi.hyundai.connected-car.io',
    apiPort: 8080,
    ccspServiceId: 'e5b3f6d0-7f83-43c9-aff3-a254db7af368',
    appId: '5a27df80-4ca1-4154-8c09-6f4029d91cf7',
    authCfb: b64decode('RFtoRq/vDXJmRndoZaZQyfOot7OrIqGVFj96iY2WL3yyH5Z/pUvlUhqmCxD2t+D65SQ='),
    authBasic:
      'Basic ZTViM2Y2ZDAtN2Y4My00M2M5LWFmZjMtYTI1NGRiN2FmMzY4OjVKRk9DcjZDMjRPZk96bERxWnA3RXdxcmtMMFd3MDRVYXhjRGlFNlVkM3FJNVNFNA==',
    authHost: 'prd.in-ccapi.hyundai.connected-car.io',
    authParam: 'euhyundaiidm',
    clientId: 'e5b3f6d0-7f83-43c9-aff3-a254db7af368',
    authClientID: '64621b96-0f0d-11ec-82a8-0242ac130003',
    pushType: 'GCM',
  },
}

export class BluelinkIndia extends Bluelink {
  private apiConfig: APIConfig
  private controlToken: ControlToken | undefined
  private europeccs2: number | undefined

  constructor(config: Config, statusCheckInterval?: number) {
    super(config)
    this.distanceUnit = this.config.distanceUnit
    if (!(config.manufacturer in API_CONFIG)) {
      throw Error(`Region ${config.manufacturer} not supported`)
    }
    this.apiConfig = API_CONFIG[config.manufacturer]!
    this.apiDomain = `https://${this.apiConfig.apiDomain}:${this.apiConfig.apiPort}`

    this.statusCheckInterval = statusCheckInterval || DEFAULT_STATUS_CHECK_INTERVAL
    this.additionalHeaders = {
      'User-Agent': 'okhttp/3.14.9',
      Host: `${this.apiConfig.apiDomain}:${this.apiConfig.apiPort}`,
      'ccsp-service-id': this.apiConfig.ccspServiceId,
      'ccsp-application-id': this.apiConfig.appId,
    }
    this.authIdHeader = 'ccsp-device-id'
    this.authHeader = 'Authorization'
    this.controlToken = undefined
    this.europeccs2 = undefined
  }

  static async init(config: Config, vin?: string, statusCheckInterval?: number) {
    const obj = new BluelinkIndia(config, statusCheckInterval)
    await obj.superInit(config)
    return obj
  }

  private getCCS2Header(): string {
    return typeof this.europeccs2 !== 'undefined'
      ? this.europeccs2.toString()
      : this.cache.car.europeccs2
        ? this.cache.car.europeccs2.toString()
        : '0'
  }

  private requestResponseValid(
    resp: Record<string, any>,
    _data: Record<string, any>,
  ): { valid: boolean; retry: boolean } {
    if (
      Object.hasOwn(resp, 'statusCode') &&
      (resp.statusCode === 200 || resp.statusCode === 204 || resp.statusCode === 302)
    ) {
      return { valid: true, retry: false }
    }
    return { valid: false, retry: true }
  }

  //This function assumes the timestring being passed is in UTC.
  private timeStringToTimestamp(timeString: number): number {
    // Format: YYYYMMDDHHMMSS to YYYY-MM-DD HH:MM:SS
    const ts: string = String(timeString)
    const formatted = ts.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3T$4:$5:$6Z')
    //if (this.config.debugLogging) this.logger.log(`timeString: ${ts}, formatted: ${formatted}, Date: ${dp}`)
    // Parse as UTC time and get timestamp
    return Number(Date.parse(formatted))
  }

  private getTempCode(temp: number): string {
    // Define temperature range as in Python
    const temperatureRange = Array.from({ length: 65 }, (_, i) => (i + 28) * 0.5)

    // Find the index of the temperature
    const tempIndex = temperatureRange.indexOf(temp)
    if (tempIndex === -1) {
      // Default to 23°C if temperature not found
      const defaultIndex = temperatureRange.indexOf(23)
      return defaultIndex.toString(16).padStart(2, '0') + 'H'
    }

    // Convert to hex format as in Python
    return tempIndex.toString(16).padStart(2, '0') + 'H'
  }

  protected async login(): Promise<BluelinkTokens | undefined> {
    // Get cookies first
    const cookies = await this._get_cookies()

    // Direct signin with username/password
    const signinData = {
      email: this.config.auth.username,
      password: this.config.auth.password,
    }

    const respSignin = await this.request({
      url: `${this.apiDomain}/api/v1/user/signin`,
      noAuth: true,
      data: JSON.stringify(signinData),
      headers: {
        'Content-Type': 'application/json',
        ...cookies,
      },
      validResponseFunction: this.requestResponseValid,
    })

    if (!this.requestResponseValid(respSignin.resp, respSignin.json).valid) {
      const error = `Failed to sign in ${JSON.stringify(respSignin.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    // Extract authorization code from redirect URL
    const redirectUrl = respSignin.json.redirectUrl
    if (!redirectUrl) {
      const error = `Failed to get redirectUrl ${JSON.stringify(respSignin.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    const params = Url.parse(redirectUrl, true).query
    const authCode = params.code
    if (!authCode) {
      const error = `Failed to extract auth code ${JSON.stringify(respSignin.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    // Get access token
    const tokenData = `grant_type=authorization_code&redirect_uri=${this.apiDomain}/api/v1/user/oauth2/redirect&code=${authCode}`
    const respTokens = await this.request({
      url: `${this.apiDomain}/api/v1/user/oauth2/token`,
      noAuth: true,
      validResponseFunction: this.requestResponseValid,
      data: tokenData,
      headers: {
        Authorization: this.apiConfig.authBasic,
        Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    if (!this.requestResponseValid(respTokens.resp, respTokens.json).valid) {
      const error = `Failed to get tokens ${JSON.stringify(respTokens.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    return {
      accessToken: `Bearer ${respTokens.json.access_token}`,
      refreshToken: respTokens.json.refresh_token,
      expiry: Math.floor(Date.now() / 1000) + Number(respTokens.json.expires_in),
      authId: await this.getDeviceId(),
    }
  }

  // Helper method to get cookies
  private async _get_cookies(): Promise<Record<string, string>> {
    const url = `${this.apiDomain}/api/v1/user/oauth2/authorize?response_type=code&state=test&client_id=${this.apiConfig.clientId}&redirect_uri=${this.apiDomain}/api/v1/user/oauth2/redirect`

    const resp = await this.request({
      url,
      noAuth: true,
      notJSON: true,
      validResponseFunction: this.requestResponseValid,
    })

    if (!this.requestResponseValid(resp.resp, resp.json).valid) {
      const error = `Failed to get cookies ${JSON.stringify(resp.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    const cookies = resp.resp.headers['set-cookie']
    if (!cookies || !Array.isArray(cookies)) {
      return {}
    }

    return cookies.reduce((acc: Record<string, string>, cookie: string) => {
      const cookieStr = cookie.split(';')[0]
      if (!cookieStr) {
        return acc
      }

      const [key, value] = cookieStr.split('=')
      if (key && value) {
        acc[key] = value
      }
      return acc
    }, {})
  }

  protected async refreshTokens(): Promise<BluelinkTokens | undefined> {
    if (!this.cache.token.refreshToken) {
      if (this.config.debugLogging) this.logger.log('No refresh token - cannot refresh')
      return undefined
    }

    const stamp = this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb)
    const refreshData = `grant_type=refresh_token&redirect_uri=https%3A%2F%2Fwww.getpostman.com%2Foauth2%2Fcallback&refresh_token=${this.cache.token.refreshToken}`

    if (this.config.debugLogging) this.logger.log('Refreshing tokens')
    const resp = await this.request({
      url: `${this.apiDomain}/api/v1/user/oauth2/token`,
      data: refreshData,
      noAuth: true,
      validResponseFunction: this.requestResponseValid,
      headers: {
        Authorization: this.apiConfig.authBasic,
        Stamp: stamp,
        'Content-Type': 'application/x-www-form-urlencoded',
        Host: this.apiConfig.apiDomain,
        Connection: 'close',
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': 'okhttp/3.14.9',
      },
    })

    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      const tokenType = resp.json.token_type
      const accessToken = `${tokenType} ${resp.json.access_token}`

      return {
        authCookie: '',
        accessToken,
        refreshToken: this.cache.token.refreshToken, // maintain existing refresh token
        expiry: Math.floor(Date.now() / 1000) + Number(resp.json.expires_in),
        authId: await this.getDeviceId(),
      }
    }

    const error = `Refresh Failed: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    return undefined
  }

  protected async getDeviceId(): Promise<string | undefined> {
    const resp = await this.request({
      url: `${this.apiDomain}/api/v1/spa/notifications/register`,
      data: JSON.stringify({
        pushRegId: `${this.genRanHex(22)}:${this.genRanHex(63)}-${this.genRanHex(55)}`,
        pushType: this.apiConfig.pushType,
        uuid: UUID.string().toLocaleLowerCase(), // native scriptable UUID method
      }),
      noAuth: true,
      validResponseFunction: this.requestResponseValid,
      headers: {
        Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
      },
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      return resp.json.resMsg.deviceId
    }

    const error = `Failed to fetch Device ID: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    return undefined
  }

  protected async getCar(): Promise<BluelinkCar | undefined> {
    let vin = this.vin
    if (!vin && this.cache) {
      vin = this.cache.car.vin
    }
    const resp = await this.request({
      url: this.apiDomain + `/api/v1/spa/vehicles`,
      validResponseFunction: this.requestResponseValid,
      headers: {},
    })

    // if multuple cars and we have no vin populate options and return undefined for user selection
    if (this.requestResponseValid(resp.resp, resp.json).valid && resp.json.resMsg.vehicles.length > 1 && !vin) {
      for (const vehicle of resp.json.resMsg.vehicles) {
        this.carOptions.push({
          vin: vehicle.vin,
          nickName: vehicle.nickname,
          modelName: vehicle.vehicleName,
          modelYear: vehicle.year,
        })
      }
      return undefined
    }

    if (this.requestResponseValid(resp.resp, resp.json).valid && resp.json.resMsg.vehicles.length > 0) {
      let vehicle = resp.json.resMsg.vehicles[0]
      if (vin) {
        for (const v of resp.json.resMsg.vehicles) {
          if (v.vin === vin) {
            vehicle = v
            break
          }
        }
      }

      this.europeccs2 = vehicle.ccuCCS2ProtocolSupport
      return {
        id: vehicle.vehicleId,
        vin: vehicle.vin,
        nickName: vehicle.nickname,
        modelName: vehicle.vehicleName,
        modelYear: vehicle.year,
        odometer: 0, // not available here
        modelColour: vehicle.detailInfo.outColor,
        modelTrim: vehicle.detailInfo.saleCarmdlCd,
        europeccs2: vehicle.ccuCCS2ProtocolSupport,
      }
    }
    const error = `Failed to retrieve vehicle list: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected returnCarStatus(maint: any, loc: any, status: any, updateTime: number): BluelinkStatus {
    // location and odometer info come from separate API calls.
    // convert odometer if needed
    const newOdometer = this.distanceUnit === 'mi' ? Math.floor(maint.odometer * 0.621371) : Math.floor(maint.odometer)

    const isCharging = status.evStatus.batteryCharge

    const chargingPower = 11 // charging power is not reported in status, just fix it.

    /* check for charge limits  --- load values from cache if available because when status
     is fetched from servers without a remote refresh, only AC % is included for some reason. So we 
     use the last available DC value until a new one is fetched for both during a forced update 
     from the car periodically or after changing charge limits. 
    */
    const chargeLimit: ChargeLimit = this.cache?.status.chargeLimit ?? {
      dcPercent: 100,
      acPercent: 100,
    }
    if (status.evStatus?.reservChargeInfos?.targetSOClist) {
      for (const target of status.evStatus.reservChargeInfos.targetSOClist) {
        if (target.plugType === 1) {
          chargeLimit.acPercent = target.targetSOClevel
        } else if (target.plugType === 0) {
          chargeLimit.dcPercent = target.targetSOClevel
        }
      }
    }

    // check for location
    let location = undefined
    if (loc.gpsDetail.coord) {
      location = {
        latitude: loc.gpsDetail.coord.lat,
        longitude: loc.gpsDetail.coord.lon,
      } as Location
    }

    // if (this.config.debugLogging)
    //   this.logger.log(
    //     `odometer: ${newOdometer}, isCharging: ${isCharging}, chargingPower: ${chargingPower}, chargeLimit: ${chargeLimit}, location: ${location}, updateTime: ${updateTime}, timeStamp: ${updateTime}`,
    //   )

    return {
      lastStatusCheck: Date.now(),
      lastRemoteStatusCheck: updateTime,
      isCharging: isCharging,
      isPluggedIn: status.evStatus.batteryPlugin > 0 ? true : false,
      chargingPower: chargingPower,
      remainingChargeTimeMins: status.evStatus.remainTime2.atc.value,
      // sometimes range back as zero? if so ignore and use cache
      range:
        status.evStatus.drvDistance[0].rangeByFuel.totalAvailableRange.value > 0
          ? Math.floor(status.evStatus.drvDistance[0].rangeByFuel.totalAvailableRange.value)
          : this.cache
            ? this.cache.status.range
            : 0,
      locked: status.doorLock,
      climate: status.airCtrlOn,
      soc: status.evStatus.batteryStatus,
      twelveSoc: 95, //see if this is reported and fix later
      odometer: newOdometer ? newOdometer : this.cache ? this.cache.status.odometer : 0,
      location: location ? location : this.cache ? this.cache.status.location : undefined,
      chargeLimit:
        chargeLimit && chargeLimit.acPercent > 0 ? chargeLimit : this.cache ? this.cache.status.chargeLimit : undefined,
    }
  }

  protected async getCarStatus(id: string, forceUpdate: boolean, _location: boolean = false): Promise<BluelinkStatus> {
    let resp
    if (!forceUpdate) {
      resp = await this.request({
        url: `${this.apiDomain}/api/v1/spa/vehicles/${id}/status/latest`,
        headers: {
          ccuCCS2ProtocolSupport: this.getCCS2Header(),
        },
        validResponseFunction: this.requestResponseValid,
      })
    } else {
      resp = await this.request({
        url: `${this.apiDomain}/api/v1/spa/vehicles/${id}/status`,
        headers: {
          ccuCCS2ProtocolSupport: this.getCCS2Header(),
        },
        validResponseFunction: this.requestResponseValid,
      })
    }

    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      const respMaint = await this.getMaintenanceAlerts(id) //for odometer reading.

      const respLoc = await this.getLocation(id) //for location.

      return this.returnCarStatus(
        respMaint,
        respLoc,
        resp.json.resMsg,
        this.timeStringToTimestamp(resp.json.resMsg.time),
      )
    }

    const error = `Failed to retrieve vehicle status: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  // named for consistency - but this is a special Authetication token - used instead of the normal Authentication token?
  // seemingly has its own expiry which we cache within the current app session only - not across app usages (i.e. saved to cache)
  protected async getAuthCode(_id: string): Promise<string> {
    if (this.controlToken && this.controlToken.expiry > Date.now()) {
      return this.controlToken.token
    }
    const resp = await this.request({
      url: `${this.apiDomain}/api/v1/user/pin?token=`,
      method: 'PUT',
      data: JSON.stringify({
        pin: this.config.auth.pin,
        deviceId: this.cache.token.authId,
      }),
      headers: {
        Host: this.apiConfig.apiDomain,
      },
      validResponseFunction: this.requestResponseValid,
    })

    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      const controlToken = `Bearer ${resp.json.controlToken}`
      const expiry = Date.now() + Number(resp.json.expiresTime) * 1000
      if (this.config.debugLogging) this.logger.log(`expiry: ${expiry}, control token: ${controlToken}`)
      this.controlToken = { expiry, token: controlToken }
      return this.controlToken.token
    }

    const error = `Failed to get control token: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
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
        url: `${this.apiDomain}/api/v1/spa/notifications/${id}/records`,
        headers: {},
        validResponseFunction: this.requestResponseValid,
      })

      if (!this.requestResponseValid(resp.resp, resp.json).valid) {
        const error = `Failed to poll for command completion: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
        if (this.config.debugLogging) this.logger.log(error)
        throw Error(error)
      }

      // iterate over all actions to find the one we are waiting for - if it exists
      for (const record of resp.json.resMsg) {
        if (record.recordId === transactionId) {
          const result = record.result
          if (result) {
            switch (result) {
              case 'success':
                return {
                  isSuccess: true,
                  data: (await this.getStatus(false, true)).status,
                }
              case 'fail':
              case 'non-response':
                return {
                  isSuccess: false,
                  data: record,
                }
              default:
                if (this.config.debugLogging)
                  this.logger.log(`Waiting for command completion: ${JSON.stringify(record)}`)
                break
            }
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
    const resp = await this.request({
      url: `${this.apiDomain}/api/v1/spa/vehicles/${id}/control/door`,
      method: 'POST',
      data: JSON.stringify({
        action: shouldLock ? 'close' : 'open',
        deviceId: this.cache.token.authId,
      }),
      headers: {},
      //authTokenOverride: await this.getAuthCode(id),
      validResponseFunction: this.requestResponseValid,
      noRetry: true,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = resp.json.msgId // SID or msgId
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
    const resp = await this.request({
      url: `${this.apiDomain}/api/v2/spa/vehicles/${id}/control/charge`,
      method: 'POST',
      data: JSON.stringify({
        action: shouldCharge ? 'start' : 'stop',
        deviceId: this.cache.token.authId,
        ccuCCS2ProtocolSupport: this.getCCS2Header(),
      }),
      headers: {
        ccuCCS2ProtocolSupport: this.getCCS2Header(),
      },
      authTokenOverride: await this.getAuthCode(id),
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = resp.json.msgId // SID or msgId
      if (transactionId) return await this.pollForCommandCompletion(id, transactionId)
    }
    const error = `Failed to send chargeStartStop command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  //Climate on and off use different endpoints, so we need two functions.
  protected async climateOn(id: string, config: ClimateRequest): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    // Set default values if not provided
    const temp = config.temp ?? 23
    const frontDefrost = config.frontDefrost ?? false
    const heating = 0

    const payload = {
      action: 'start',
      hvacType: 1,
      options: {
        defrost: frontDefrost,
        heating1: heating,
      },
      tempCode: this.getTempCode(temp),
      unit: 'C',
    }

    // Call the API
    const resp = await this.request({
      url: `${this.apiDomain}/api/v1/spa/vehicles/${id}/control/engine`,
      method: 'POST',
      data: JSON.stringify(payload),
      headers: {},
      validResponseFunction: this.requestResponseValid,
    })

    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = resp.json.msgId
      if (transactionId) return await this.pollForCommandCompletion(id, transactionId)
    }

    const error = `Failed to start climate: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async climateOff(id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const payload = {
      action: 'stop',
    }

    // Call the API - note this uses v2
    const resp = await this.request({
      url: `${this.apiDomain}/api/v2/spa/vehicles/${id}/control/engine`,
      method: 'POST',
      data: JSON.stringify(payload),
      headers: {},
      authTokenOverride: await this.getAuthCode(id),
      validResponseFunction: this.requestResponseValid,
    })

    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = resp.json.msgId
      if (transactionId) return await this.pollForCommandCompletion(id, transactionId)
    }

    const error = `Failed to stop climate: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async startValetMode(id: string): Promise<{ isSuccess: boolean }> {
    return await this.valetModeAction(id, true)
  }

  protected async stopValetMode(id: string): Promise<{ isSuccess: boolean }> {
    return await this.valetModeAction(id, false)
  }

  protected async valetModeAction(id: string, valetModeOn: boolean): Promise<{ isSuccess: boolean }> {
    // Create payload
    const payload = valetModeOn ? { action: 'activate' } : { action: 'deactivate' }

    const resp = await this.request({
      url: `${this.apiDomain}/api/v2/spa/vehicles/${id}/control/valet`,
      method: 'POST',
      data: JSON.stringify(payload),
      headers: {},
      authTokenOverride: await this.getAuthCode(id),
      validResponseFunction: this.requestResponseValid,
    })

    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      const transactionId = resp.json.msgId
      if (transactionId)
        return { isSuccess: true } //await this.pollForCommandCompletion(id, transactionId)
      else return { isSuccess: false } //valet mode state is not in the car status json and does not show
      // up in the record endpoint used for polling, so just return true if a msgId comes in.
    }

    const error = `Failed to set valet mode: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async setChargeLimit(
    id: string,
    config: ChargeLimit,
  ): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const resp = await this.request({
      // use v1 for now - need a trace to see if v2 available or not
      url: `${this.apiDomain}/api/v1/spa/vehicles/${id}/charge/target`,
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
      headers: {
        ccuCCS2ProtocolSupport: this.getCCS2Header(),
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      return {
        isSuccess: true,
        data: await this.getCarStatus(id, true),
      }
    }
    const error = `Failed to send chargeLimit command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async getMaintenanceAlerts(id: string): Promise<any> {
    const resp = await this.request({
      url: `${this.apiDomain}/api/v1/spa/vehicles/${id}/setting/alert/maintenance`,
      validResponseFunction: this.requestResponseValid,
      headers: {},
    })

    if (!this.requestResponseValid(resp.resp, resp.json).valid) {
      const error = `Failed to get maintenance alerts: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      return []
    }

    return resp.json.resMsg
  }

  protected async getLocation(id: string): Promise<any> {
    const resp = await this.request({
      url: `${this.apiDomain}/api/v1/spa/vehicles/${id}/location/park`,
      validResponseFunction: this.requestResponseValid,
      headers: {},
    })

    if (!this.requestResponseValid(resp.resp, resp.json).valid) {
      const error = `Failed to get location: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      return undefined
    }

    return resp.json.resMsg
  }
}
