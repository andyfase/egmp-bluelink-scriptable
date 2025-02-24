import { Bluelink, BluelinkTokens, BluelinkCar, BluelinkStatus, DEFAULT_STATUS_CHECK_INTERVAL } from './base'
import { Config } from '../../config'
import { Buffer } from 'buffer'
import Url from 'url'

const b64decode = (str: string): string => Buffer.from(str, 'base64').toString('binary')
// const b64encode = (str: string): string => Buffer.from(str, 'binary').toString('base64')

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
}

export class BluelinkEurope extends Bluelink {
  // private carVin: string | undefined
  // private carId: string | undefined
  private apiConfig: APIConfig

  constructor(config: Config, statusCheckInterval?: number) {
    super(config)
    this.distanceUnit = 'mi'
    if (!(config.manufacturer in API_CONFIG)) {
      logError(`fail ${config.manufacturer} indeed`)
      throw Error(`Region ${config.manufacturer} not supported`)
    }
    this.apiConfig = API_CONFIG[config.manufacturer]!
    this.apiDomain = `https://${this.apiConfig.apiDomain}:${this.apiConfig.apiPort}`

    this.statusCheckInterval = statusCheckInterval || DEFAULT_STATUS_CHECK_INTERVAL
    this.additionalHeaders = {
      'User-Agent': 'okhttp/3.14.9',
      offset: `-${new Date().getTimezoneOffset() / 60}`,
      ccuCCS2ProtocolSupport: '0',
      'ccsp-service-id': this.apiConfig.ccspServiceId,
      'ccsp-application-id': this.apiConfig.appId,
    }
    this.authIdHeader = 'ccsp-device-id'
    this.authHeader = 'Authorization'
  }

  static async init(config: Config, vin?: string, statusCheckInterval?: number) {
    const obj = new BluelinkEurope(config, statusCheckInterval)
    await obj.superInit(config)
    return obj
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
      url: `${this.apiDomain}/api/v1/user/oauth2/authorize?response_type=code&state=test&client_id=${this.apiConfig.clientId}&redirect_uri=${this.apiDomain}/api/v1/user/oauth2/redirect`,
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
      url: `https://${this.apiConfig.authHost}/auth/realms/euhyundaiidm/protocol/openid-connect/auth?client_id=${this.apiConfig.authClientID}&scope=openid%20profile%20email%20phone&response_type=code&hkid_session_reset=true&redirect_uri=${this.apiDomain}/api/v1/user/integration/redirect/login&ui_locales=en&state=${serviceId}:${userId}`,
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
      const loginData = `username=${this.config.auth.username}&password=${this.config.auth.password}&credentialId=&rememberMe=on`
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
    } // end of optional login form

    // set language
    const respLang = await this.request({
      url: `${this.apiDomain}/api/v1/user/language`,
      noAuth: true,
      notJSON: true,
      data: JSON.stringify({ language: this.config.auth.subregion }),
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

      return {
        id: vehicle.vehicleId,
        vin: vehicle.vin,
        nickName: vehicle.nickname,
        modelName: vehicle.vehicleName,
        modelYear: vehicle.year,
        odometer: 0, // not available here
        modelColour: vehicle.detailInfo.outColor,
        modelTrim: vehicle.detailInfo.saleCarmdlCd,
      }
    }
    const error = `Failed to retrieve vehicle list: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }

  protected returnCarStatus(fullStatus: any, forceUpdate: boolean, odometer?: number): BluelinkStatus {
    const status = fullStatus.vehicleStatus
    const lastRemoteCheckString = status.time + 'Z'
    const df = new DateFormatter()
    df.dateFormat = 'yyyyMMddHHmmssZ'
    const lastRemoteCheck = df.date(lastRemoteCheckString)

    // For whatever reason sometimes the status will not have the evStatus object
    // deal with that with either cached or zero values
    if (!status.evStatus) {
      return {
        lastStatusCheck: Date.now(),
        lastRemoteStatusCheck: forceUpdate ? Date.now() : lastRemoteCheck.getTime(),
        isCharging: this.cache ? this.cache.status.isCharging : false,
        isPluggedIn: this.cache ? this.cache.status.isCharging : false,
        chargingPower: this.cache ? this.cache.status.chargingPower : 0,
        remainingChargeTimeMins: this.cache ? this.cache.status.remainingChargeTimeMins : 0,
        range: this.cache ? this.cache.status.range : 0,
        soc: this.cache ? this.cache.status.soc : 0,
        locked: status.doorLock,
        climate: status.airCtrlOn,
        twelveSoc: status.battery.batSoc ? status.battery.batSoc : 0,
        odometer: odometer ? odometer : this.cache ? this.cache.status.odometer : 0,
      }
    }

    // deal with charging speed - JSON response if variable / inconsistent - hence check for various objects
    let chargingPower = 0
    let isCharging = false
    if (status.evStatus.batteryPower && status.evStatus.batteryCharge) {
      if (status.evStatus.batteryPower.batteryFstChrgPower && status.evStatus.batteryPower.batteryFstChrgPower > 0) {
        chargingPower = status.evStatus.batteryPower.batteryFstChrgPower
        isCharging = true
      } else if (
        status.evStatus.batteryPower.batteryStndChrgPower &&
        status.evStatus.batteryPower.batteryStndChrgPower > 0
      ) {
        chargingPower = status.evStatus.batteryPower.batteryStndChrgPower
        isCharging = true
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
          ? Math.floor(status.evStatus.drvDistance[0].rangeByFuel.evModeRange.value)
          : this.cache
            ? this.cache.status.range
            : 0,
      locked: status.doorLock,
      climate: status.airCtrlOn,
      soc: status.evStatus.batteryStatus,
      twelveSoc: status.battery.batSoc ? status.battery.batSoc : 0,
      odometer:
        fullStatus.odometer && fullStatus.odometer.value
          ? fullStatus.odometer.value
          : this.cache
            ? this.cache.status.odometer
            : 0,
    }
  }

  protected async getCarStatus(id: string, forceUpdate: boolean): Promise<BluelinkStatus> {
    // we use older non CCS status endpoint as its more consistent with other regions and the remote status check is a sync (hanging) call
    const api = forceUpdate ? '' : '/latest' // latest == cached
    const resp = await this.request({
      url: `${this.apiDomain}/api/v1/spa/vehicles/${id}/status` + api,
      headers: {
        Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
      },
      validResponseFunction: this.requestResponseValid,
    })

    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      return this.returnCarStatus(resp.json.resMsg.vehicleStatusInfo, forceUpdate)
    }

    const error = `Failed to retrieve vehicle status: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }
}
