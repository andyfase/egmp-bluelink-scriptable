import {
  Bluelink,
  BluelinkTokens,
  BluelinkCar,
  BluelinkStatus,
  ClimateRequest,
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
  clientId: string
  authClientID: string
  pushType: string
}

const API_CONFIG: Record<string, APIConfig> = {
  hyundai: {
    apiDomain: 'prd.eu-ccapi.hyundai.com',
    apiPort: 8080,
    ccspServiceId: '6d477c38-3ca4-4cf3-9557-2a1929a94654',
    appId: '014d2225-8495-4735-812d-2616334fd15d',
    authCfb: b64decode('RFtoRq/vDXJmRndoZaZQyfOot7OrIqGVFj96iY2WL3yyH5Z/pUvlUhqmCxD2t+D65SQ='),
    authBasic:
      'Basic NmQ0NzdjMzgtM2NhNC00Y2YzLTk1NTctMmExOTI5YTk0NjU0OktVeTQ5WHhQekxwTHVvSzB4aEJDNzdXNlZYaG10UVI5aVFobUlGampvWTRJcHhzVg==',
    authHost: 'eu-account.hyundai.com',
    clientId: '6d477c38-3ca4-4cf3-9557-2a1929a94654',
    authClientID: '64621b96-0f0d-11ec-82a8-0242ac130003',
    pushType: 'GCM',
  },
  kia: {
    apiDomain: 'prd.eu-ccapi.kia.com',
    apiPort: 8080,
    ccspServiceId: 'fdc85c00-0a2f-4c64-bcb4-2cfb1500730a',
    appId: 'a2b8469b-30a3-4361-8e13-6fceea8fbe74',
    authCfb: b64decode('wLTVxwidmH8CfJYBWSnHD6E0huk0ozdiuygB4hLkM5XCgzAL1Dk5sE36d/bx5PFMbZs='),
    authBasic: 'Basic ZmRjODVjMDAtMGEyZi00YzY0LWJjYjQtMmNmYjE1MDA3MzBhOnNlY3JldA==',
    authHost: 'eu-account.hyundai.com',
    clientId: 'fdc85c00-0a2f-4c64-bcb4-2cfb1500730a',
    authClientID: '572e0304-5f8d-4b4c-9dd5-41aa84eed160',
    pushType: 'APNS',
  },
}

export class BluelinkEurope extends Bluelink {
  private lang = 'en' // hard-code to en as the language doesnt appear to matter from an API perspective.
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
      offset: this.getTimeZone().slice(0, 3),
      'ccsp-service-id': this.apiConfig.ccspServiceId,
      'ccsp-application-id': this.apiConfig.appId,
    }
    this.authIdHeader = 'ccsp-device-id'
    this.authHeader = 'Authorization'
    this.controlToken = undefined
    this.europeccs2 = undefined
  }

  static async init(config: Config, vin?: string, statusCheckInterval?: number) {
    const obj = new BluelinkEurope(config, statusCheckInterval)
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

  protected async login(): Promise<BluelinkTokens | undefined> {
    const respReset = await this.request({
      url: `${this.apiDomain}/api/v1/user/oauth2/authorize?response_type=code&state=test&client_id=${this.apiConfig.clientId}&redirect_uri=${this.apiDomain}/api/v1/user/oauth2/redirect&lang=${this.lang}`,
      noAuth: true,
      notJSON: true,
      validResponseFunction: this.requestResponseValid,
    })

    if (!this.requestResponseValid(respReset.resp, respReset.json).valid) {
      const error = `Failed to reset session ${JSON.stringify(respReset.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }
    // user ID and Service ID
    const respIntegration = await this.request({
      url: `${this.apiDomain}/api/v1/user/integrationinfo`,
      noAuth: true,
      validResponseFunction: this.requestResponseValid,
    })

    if (!this.requestResponseValid(respIntegration.resp, respIntegration.json).valid) {
      const error = `Failed to reset session ${JSON.stringify(respIntegration.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }
    const userId = respIntegration.json.userId
    const serviceId = respIntegration.json.serviceId
    if (!userId || !serviceId) {
      const error = `Failed to get userId or serviceId ${JSON.stringify(respIntegration.resp.json)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    // start login - this could auto redirect and auto login based on previous state
    // or could send back form to process actual login - so need to handle both
    const respLoginForm = await this.request({
      url: `https://${this.apiConfig.authHost}/auth/realms/euhyundaiidm/protocol/openid-connect/auth?client_id=${this.apiConfig.authClientID}&scope=openid%20profile%20email%20phone&response_type=code&hkid_session_reset=true&redirect_uri=${this.apiDomain}/api/v1/user/integration/redirect/login&ui_locales=${this.lang}&state=${serviceId}:${userId}`,
      noAuth: true,
      notJSON: true,
      validResponseFunction: this.requestResponseValid,
    })

    if (!this.requestResponseValid(respLoginForm.resp, respLoginForm.json).valid) {
      const error = `Failed to get login form ${JSON.stringify(respLoginForm.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    if (!respLoginForm.resp.url.startsWith(this.apiDomain)) {
      // we have not been redirected - so need to login
      // Form HTML looks like
      // <form id="kc-form-login" onsubmit="login.disabled = true; return true;" action="https://eu-account.hyundai.com/auth/realms/euhyundaiidm/login-actions/authenticate?session_code=<session_code>&amp;execution=<execution_id>&amp;client_id=<client_id>&amp;tab_id=<tab_id>" method="post">
      // extract entire action URL - confirm its the right host - then extract session code and execution ID
      const loginURL = respLoginForm.json.match(/action="([^"]+)"/)
      if (!loginURL || loginURL.length < 2 || !loginURL[1].startsWith(`https://${this.apiConfig.authHost}`)) {
        const error = `Failed to extract login URL ${JSON.stringify(respLoginForm.resp)}`
        if (this.config.debugLogging) this.logger.log(error)
        throw Error(error)
      }

      const params = Url.parse(loginURL[1].replaceAll('&amp;', '&'), true).query
      const sessionCode = params.session_code
      const executionId = params.execution
      const tabId = params.tab_id
      if (!sessionCode || !executionId || !tabId) {
        const error = `Failed to extract session code or execution ID ${JSON.stringify(params)}`
        if (this.config.debugLogging) this.logger.log(error)
        throw Error(error)
      }

      // now actually login
      const loginData = `username=${encodeURIComponent(this.config.auth.username)}&password=${encodeURIComponent(this.config.auth.password)}&credentialId=&rememberMe=on`
      const respLogin = await this.request({
        url: `https://${this.apiConfig.authHost}/auth/realms/euhyundaiidm/login-actions/authenticate?session_code=${sessionCode}&execution=${executionId}&client_id=${this.apiConfig.authClientID}&tab_id=${tabId}`,
        noAuth: true,
        notJSON: true,
        validResponseFunction: this.requestResponseValid,
        method: 'POST',
        data: loginData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })

      if (!this.requestResponseValid(respLogin.resp, respLogin.json).valid) {
        const error = `Failed to login ${JSON.stringify(respLogin.resp)}`
        if (this.config.debugLogging) this.logger.log(error)
        throw Error(error)
      }

      // at this point we should have been rediected to the API domain after completing login - if not its a error - likely password issues
      if (!respLogin.resp.url.startsWith(this.apiDomain)) {
        const error = `Login did not redirect - login error: ${JSON.stringify(respLogin.resp)} data: ${respLogin.json}`
        if (this.config.debugLogging) this.logger.log(error)
        return undefined
      }
    } // end of optional login form

    // set language
    const respLang = await this.request({
      url: `${this.apiDomain}/api/v1/user/language`,
      noAuth: true,
      notJSON: true,
      data: JSON.stringify({ language: this.lang }),
      validResponseFunction: this.requestResponseValid,
    })

    if (!this.requestResponseValid(respLang.resp, respLang.json).valid) {
      const error = `Failed to set language ${JSON.stringify(respLang.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    // silent login - which returns Auth Code needed for final call to get tokens
    const respSilent = await this.request({
      url: `${this.apiDomain}/api/v1/user/silentsignin`,
      noAuth: true,
      data: JSON.stringify({ intUserId: '' }),
      validResponseFunction: this.requestResponseValid,
    })

    if (!this.requestResponseValid(respLang.resp, respLang.json).valid) {
      const error = `Failed to perform silent login ${JSON.stringify(respLang.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    const redirectUrl = respSilent.json.redirectUrl
    if (!redirectUrl) {
      const error = `Failed to get redirectUrl ${JSON.stringify(respSilent.resp.json)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }
    const params = Url.parse(redirectUrl, true).query
    const authCode = params.code
    if (!authCode) {
      const error = `Failed to extract auth code ${JSON.stringify(respSilent.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    // final login to get tokens
    const tokenData = `client_id=${this.apiConfig.clientId}&grant_type=authorization_code&code=${authCode}&redirect_uri=${this.apiDomain}/api/v1/user/oauth2/redirect`
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
      const error = `Failed to login ${JSON.stringify(respTokens.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    return {
      accessToken: `Bearer ${respTokens.json.access_token}`,
      refreshToken: respTokens.json.refresh_token,
      expiry: Math.floor(Date.now() / 1000) + Number(respTokens.json.expires_in), // we only get a expireIn not a actual date
      authId: await this.getDeviceId(),
    }
  }

  protected async refreshTokens(): Promise<BluelinkTokens | undefined> {
    if (!this.cache.token.refreshToken) {
      if (this.config.debugLogging) this.logger.log('No refresh token - cannot refresh')
      return undefined
    }
    const refreshData = `client_id=${this.apiConfig.clientId}&grant_type=refresh_token&refresh_token=${this.cache.token.refreshToken}&redirect_uri=${this.apiDomain}/api/v1/user/oauth2/redirect`

    if (this.config.debugLogging) this.logger.log('Refreshing tokens')
    const resp = await this.request({
      url: `${this.apiDomain}/api/v1/user/oauth2/token`,
      data: refreshData,
      noAuth: true,
      validResponseFunction: this.requestResponseValid,
      headers: {
        Authorization: this.apiConfig.authBasic,
        Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      return {
        authCookie: '',
        accessToken: `Bearer ${resp.json.access_token}`,
        refreshToken: this.cache.token.refreshToken, // we never recieve a new refresh token
        expiry: Math.floor(Date.now() / 1000) + Number(resp.json.expires_in), // we only get a expireIn not a actual date
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

  protected async getCar(): Promise<BluelinkCar> {
    let vin = this.vin
    if (!vin && this.cache) {
      vin = this.cache.car.vin
    }

    const resp = await this.request({
      url: this.apiDomain + `/api/v1/spa/vehicles`,
      validResponseFunction: this.requestResponseValid,
      headers: {
        Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
      },
    })
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

  protected returnCarStatus(status: any, updateTime: number): BluelinkStatus {
    // cached status contains a wrapped status object along with odometer info - force status does not
    // force status also does not include a time field

    // convert odometer if needed
    const newOdometer =
      this.distanceUnit === 'mi'
        ? Math.floor(status.Drivetrain.Odometer * 0.621371)
        : Math.floor(status.Drivetrain.Odometer)

    // isCharging based on plug being connected and remainingTime being above zero
    let isCharging = false
    let chargingPower = 0
    if (
      status.Green.ChargingInformation.ConnectorFastening.State &&
      status.Green.ChargingInformation.Charging.RemainTime > 0
    ) {
      isCharging = true
      chargingPower = status.Green.Electric.SmartGrid.RealTimePower
    }

    return {
      lastStatusCheck: Date.now(),
      lastRemoteStatusCheck: Number(updateTime),
      isCharging: isCharging,
      isPluggedIn: status.Green.ChargingInformation.ConnectorFastening.State > 0 ? true : false,
      chargingPower: chargingPower,
      remainingChargeTimeMins: status.Green.ChargingInformation.Charging.RemainTime,
      // sometimes range back as zero? if so ignore and use cache
      range:
        status.Drivetrain.FuelSystem.DTE.Total > 0
          ? Math.floor(status.Drivetrain.FuelSystem.DTE.Total)
          : this.cache
            ? this.cache.status.range
            : 0,
      locked: !(
        Boolean(status.Cabin.Door.Row1.Driver.Open) &&
        Boolean(status.Cabin.Door.Row1.Passenger.Open) &&
        Boolean(status.Cabin.Door.Row2.Driver.Open) &&
        Boolean(status.Cabin.Door.Row2.Passenger.Open)
      ),
      climate: Boolean(status.Cabin.HVAC.Row1.Driver.Blower.SpeedLevel > 0),
      soc: status.Green.BatteryManagement.BatteryRemain.Ratio,
      twelveSoc: status.Electronics.Battery.Level ? status.Electronics.Battery.Level : 0,
      odometer: newOdometer ? newOdometer : this.cache ? this.cache.status.odometer : 0,
    }
  }

  protected async getCarStatus(id: string, forceUpdate: boolean): Promise<BluelinkStatus> {
    // CCS2 endpoint appears to be the only endpoint that works consistantly across all cars
    if (!forceUpdate) {
      const resp = await this.request({
        url: `${this.apiDomain}/api/v1/spa/vehicles/${id}/ccs2/carstatus/latest`,
        headers: {
          Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
          ccuCCS2ProtocolSupport: this.getCCS2Header(),
        },
        validResponseFunction: this.requestResponseValid,
      })

      if (this.requestResponseValid(resp.resp, resp.json).valid) {
        return this.returnCarStatus(resp.json.resMsg.state.Vehicle, resp.json.resMsg.lastUpdateTime)
      }
      const error = `Failed to retrieve vehicle status: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    // force update does not return a useful response hence we send the command and then poll the cached status until it updates
    const currentTime = Date.now()
    const resp = await this.request({
      url: `${this.apiDomain}/api/v1/spa/vehicles/${id}/ccs2/carstatus`,
      headers: {
        Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
        ccuCCS2ProtocolSupport: this.getCCS2Header(),
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

    const error = `Failed to retrieve remote vehicle status: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  // named for consistency - but this is a special Authetication token - used instead of the normal Authentication token?
  // seemingly has its own expiry which we cache within the current app session only - not across app usages (i.e. saved to cache)
  protected async getAuthCode(id: string): Promise<string> {
    if (this.controlToken && this.controlToken.expiry > Date.now()) {
      return this.controlToken.token
    }
    const resp = await this.request({
      url: `${this.apiDomain}/api/v1/user/pin`,
      method: 'PUT',
      data: JSON.stringify({
        pin: this.config.auth.pin,
        deviceId: this.cache.token.authId,
      }),
      headers: {
        vehicleId: id,
        Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
        ccuCCS2ProtocolSupport: this.getCCS2Header(),
      },
      validResponseFunction: this.requestResponseValid,
    })

    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.controlToken = {
        expiry: Date.now() + Number(resp.json.expiresTime) * 1000,
        token: `Bearer ${resp.json.controlToken}`,
      }
      return this.controlToken.token
    }
    const error = `Failed to get auth code: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
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
        headers: {
          Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
          ccuCCS2ProtocolSupport: this.getCCS2Header(),
        },
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
      url: `${this.apiDomain}/api/v2/spa/vehicles/${id}/ccs2/control/door`,
      method: 'POST',
      data: JSON.stringify({
        command: shouldLock ? 'close' : 'open',
      }),
      headers: {
        Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
        ccuCCS2ProtocolSupport: this.getCCS2Header(),
      },
      authTokenOverride: await this.getAuthCode(id),
      validResponseFunction: this.requestResponseValid,
      noRetry: true,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
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
      url: `${this.apiDomain}/api/v2/spa/vehicles/${id}/ccs2/control/charge`,
      method: 'POST',
      data: JSON.stringify({
        command: shouldCharge ? 'start' : 'stop',
        ccuCCS2ProtocolSupport: this.getCCS2Header(),
      }),
      headers: {
        Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
        ccuCCS2ProtocolSupport: this.getCCS2Header(),
      },
      authTokenOverride: await this.getAuthCode(id),
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      const transactionId = resp.json.msgId // SID or msgId
      if (transactionId) return await this.pollForCommandCompletion(id, transactionId)
    }
    const error = `Failed to send chargeStartStop command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected async climateOn(id: string, config: ClimateRequest): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    return await this.climateStartStop(id, {
      command: 'start',
      windshieldFrontDefogState: config.frontDefrost,
      hvacTempType: 1,
      heating1: this.getHeatingValue(config.rearDefrost, config.steering),
      tempUnit: this.config.tempType,
      drvSeatLoc: this.distanceUnit === 'mi' ? 'R' : 'L',
      hvacTemp: config.temp,
    })
  }

  protected async climateOff(id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    return await this.climateStartStop(id, {
      command: 'stop',
    })
  }

  protected async climateStartStop(
    id: string,
    climateRequest: any,
  ): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    const resp = await this.request({
      url: `${this.apiDomain}/api/v2/spa/vehicles/${id}/ccs2/control/temperature`,
      method: 'POST',
      data: JSON.stringify(climateRequest),
      headers: {
        Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
        ccuCCS2ProtocolSupport: this.getCCS2Header(),
      },
      authTokenOverride: await this.getAuthCode(id),
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      const transactionId = resp.json.msgId // SID or msgId
      if (transactionId) return await this.pollForCommandCompletion(id, transactionId)
    }
    const error = `Failed to send climateOff command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }
}
