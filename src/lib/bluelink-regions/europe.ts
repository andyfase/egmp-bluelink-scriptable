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
import Url from 'url'
import { isNotEmptyObject } from '../util'

interface ControlToken {
  expiry: number
  token: string
}

interface APIConfig {
  apiDomain: string
  apiPort: number
  appId: string
  authCfb: string
  authBasic: string
  authHost: string
  authClientID?: string
  authParam: string
  clientId: string
  pushType: string
}

const API_CONFIG: Record<string, APIConfig> = {
  hyundai: {
    apiDomain: 'prd.eu-ccapi.hyundai.com',
    apiPort: 8080,
    appId: '014d2225-8495-4735-812d-2616334fd15d',
    authCfb: 'RFtoRq/vDXJmRndoZaZQyfOot7OrIqGVFj96iY2WL3yyH5Z/pUvlUhqmCxD2t+D65SQ=',
    authBasic:
      'Basic NmQ0NzdjMzgtM2NhNC00Y2YzLTk1NTctMmExOTI5YTk0NjU0OktVeTQ5WHhQekxwTHVvSzB4aEJDNzdXNlZYaG10UVI5aVFobUlGampvWTRJcHhzVg==',
    authHost: 'eu-account.hyundai.com',
    clientId: '6d477c38-3ca4-4cf3-9557-2a1929a94654',
    authParam: 'euhyundaiidm',
    authClientID: '64621b96-0f0d-11ec-82a8-0242ac130003',
    pushType: 'GCM',
  },
  kia: {
    apiDomain: 'prd.eu-ccapi.kia.com',
    apiPort: 8080,
    appId: 'a2b8469b-30a3-4361-8e13-6fceea8fbe74',
    authCfb: 'wLTVxwidmH8CfJYBWSnHD6E0huk0ozdiuygB4hLkM5XCgzAL1Dk5sE36d/bx5PFMbZs=',
    authBasic: 'Basic ZmRjODVjMDAtMGEyZi00YzY0LWJjYjQtMmNmYjE1MDA3MzBhOnNlY3JldA==',
    authHost: 'idpconnect-eu.kia.com',
    clientId: 'fdc85c00-0a2f-4c64-bcb4-2cfb1500730a',
    authParam: 'eukiaidm',
    authClientID: 'fdc85c00-0a2f-4c64-bcb4-2cfb1500730a',
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
      'ccsp-service-id': this.apiConfig.clientId,
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
    // reset session - get initial cookies
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

    return this.config.manufacturer === 'kia' ? await this.KiaLogin() : await this.HyundaiLogin()
  }

  protected async HyundaiLogin(): Promise<BluelinkTokens | undefined> {
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
      url: `https://${this.apiConfig.authHost}/auth/realms/${this.apiConfig.authParam}/protocol/openid-connect/auth?client_id=${this.apiConfig.authClientID}&scope=openid%20profile%20email%20phone&response_type=code&hkid_session_reset=true&redirect_uri=${this.apiDomain}/api/v1/user/integration/redirect/login&ui_locales=${this.lang}&state=${serviceId}:${userId}`,
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
        url: `https://${this.apiConfig.authHost}/auth/realms/${this.apiConfig.authParam}/login-actions/authenticate?session_code=${sessionCode}&execution=${executionId}&client_id=${this.apiConfig.authClientID}&tab_id=${tabId}`,
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

    // silent login - which returns Auth Code needed for final call to get tokens
    const respSilent = await this.request({
      url: `${this.apiDomain}/api/v1/user/silentsignin`,
      noAuth: true,
      data: JSON.stringify({ intUserId: '' }),
      validResponseFunction: this.requestResponseValid,
    })

    if (!this.requestResponseValid(respSilent.resp, respSilent.json).valid) {
      const error = `Failed to perform silent login ${JSON.stringify(respSilent.resp)}`
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

  protected oauthAuthorize(login_url: string, logged_in_url: string, auth_url: string, callback_url: string) {
    // @ts-ignore
    return new Promise((resolve, reject) => {
      const webview = new WebView()
      webview.shouldAllowRequest = (request) => {
        if (!request.url.startsWith(callback_url) && !request.url.startsWith(logged_in_url)) return true
        if (request.url.startsWith(logged_in_url)) {
          // we have logged in - now wait for redirect to callback URL
          webview.loadURL(auth_url)
          return true
        }
        resolve(request.url)
        // HERE - Close the WebView
        webview.loadHTML(
          `
          <!DOCTYPE html>
          <html>
          <body style="background-color:#1c1c1e;">

          <center>
          <h1 style="color: white; font-family: Arial, Helvetica; font-size: xxx-large;">Login Successful</h1>
          <p style="color: white; font-family: Arial, Helvetica; font-size: xx-large;">This screen should auto-close, if not please close window.</p>
          </center>

          </body>
          </html>
          `,
        )
        return false
      }
      webview.loadURL(login_url)
      webview
        .present(false)
        .then(() => {
          reject(new Error('Could not complete login. Please try again.'))
        })
        .catch(reject)
    })
  }

  protected async KiaLogin(): Promise<BluelinkTokens | undefined> {
    // start login - new flow not involving forms anymore
    const respLoginStart = await this.request({
      url:
        `https://${this.apiConfig.authHost}/auth/api/v2/user/oauth2/authorize?` +
        [
          `client_id=${this.apiConfig.clientId}`,
          `response_type=code`,
          `redirect_uri=https://${this.apiConfig.apiDomain}:${this.apiConfig.apiPort}/api/v1/user/oauth2/redirect`,
          `lang=en`,
          `state=ccsp`,
        ].join('&'),
      noAuth: true,
      notJSON: true,
      validResponseFunction: this.requestResponseValid,
    })

    if (!this.requestResponseValid(respLoginStart.resp, respLoginStart.json).valid) {
      const error = `Failed to perform first login action ${JSON.stringify(respLoginStart.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    // extract connector_session_key from URL
    const connectorURL = Url.parse(decodeURI(respLoginStart.resp.url), true).query
    const nextUri = connectorURL.next_uri
    if (!nextUri || typeof nextUri !== 'string') {
      const error = `Failed to extract next_uri from login response ${JSON.stringify(respLoginStart.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }
    const connectorParams = Url.parse(decodeURI(nextUri), true).query
    const connectorSessionKey = connectorParams.connector_session_key
    if (!connectorSessionKey) {
      const error = `Failed to extract connector_session_key ${JSON.stringify(respLoginStart.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    const authUrl =
      `https://${this.apiConfig.authHost}/auth/api/v2/user/oauth2/authorize?` +
      [
        `client_id=${this.apiConfig.clientId}`,
        `redirect_uri=https://${this.apiConfig.apiDomain}:${this.apiConfig.apiPort}/api/v1/user/oauth2/redirect`,
        'response_type=code',
        'scope=',
        'state=ccsp',
        `connector_client_id=hmgid1.0-${this.apiConfig.clientId}`,
        'ui_locales=',
        'connector_scope=',
        `connector_session_key=${connectorSessionKey}`,
      ].join('&')

    const callback_url = (await this.oauthAuthorize(
      'https://idpconnect-eu.kia.com/auth/api/v2/user/oauth2/authorize?ui_locales=en&scope=openid%20profile%20email%20phone&response_type=code&client_id=peukiaidm-online-sales&redirect_uri=https://www.kia.com/api/bin/oneid/login&state=aHR0cHM6Ly93d3cua2lhLmNvbTo0NDMvZGUvP190bT0xNzU2MjE3NzM5MjYyJl90bT0xNzU2MjM3OTAxNTAxJl90bT0xNzU2MjM5NjY0OTU2Jl90bT0xNzU2MjQzNDY3NDUwJl90bT0xNzU2MjQzNjI5MDk3_default',
      'https://www.kia.com/',
      authUrl,
      'https://prd.eu-ccapi.kia.com:8080/api/v1/user/oauth2/redirect',
    )) as string

    // extract code from callback URL
    const codeParams = Url.parse(callback_url, true).query
    const code = codeParams.code
    if (!code) {
      const error = `Failed to extract code from redirect ${callback_url}`
      if (this.config.debugLogging) this.logger.log(error)
      return undefined // likely username or password incorrect
    }

    // final login to get tokens
    const respTokens = await this.request({
      url: `https://${this.apiConfig.authHost}/auth/api/v2/user/oauth2/token`,
      noAuth: true,
      validResponseFunction: this.requestResponseValid,
      data: [
        'grant_type=authorization_code',
        `code=${code}`,
        `redirect_uri=https://${this.apiConfig.apiDomain}:${this.apiConfig.apiPort}/api/v1/user/oauth2/redirect`,
        `client_id=${this.apiConfig.clientId}`,
        'client_secret=secret',
      ].join('&'),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    if (!this.requestResponseValid(respTokens.resp, respTokens.json).valid) {
      const error = `Failed to login ${JSON.stringify(respTokens.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    // this causes the script to restart to dismiss the webview
    this.loginRequiredWebview = true

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

    if (this.config.debugLogging) this.logger.log('Refreshing tokens')
    const resp = await this.request({
      url: `${this.apiDomain}/api/v1/user/oauth2/token`,
      data: [
        `client_id=${this.apiConfig.clientId}`,
        'grant_type=refresh_token',
        `refresh_token=${this.cache.token.refreshToken}`,
        `redirect_uri=${this.apiDomain}:${this.apiConfig.apiPort}/api/v1/user/oauth2/redirect`,
      ].join('&'),
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

  protected async getCar(): Promise<BluelinkCar | undefined> {
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

    if (!this.requestResponseValid(resp.resp, resp.json).valid) {
      const error = `Failed to retrieve vehicles: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

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
      // check for charging power as sometimes not available
      if (status.Green.Electric && status.Green.Electric.SmartGrid && status.Green.Electric.SmartGrid.RealTimePower) {
        chargingPower = status.Green.Electric.SmartGrid.RealTimePower
      }
    }

    // check for charge limits
    const chargeLimit: ChargeLimit = {
      dcPercent: 0,
      acPercent: 0,
    }
    if (status.Green.ChargingInformation && status.Green.ChargingInformation.TargetSoC) {
      chargeLimit.acPercent = status.Green.ChargingInformation.TargetSoC.Standard
      chargeLimit.dcPercent = status.Green.ChargingInformation.TargetSoC.Quick
    }

    // check for location
    let location = undefined
    if (status.Location && status.Location.GeoCoord) {
      location = {
        latitude: status.Location.GeoCoord.Latitude,
        longitude: status.Location.GeoCoord.Longitude,
      } as Location
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
      location: location ? location : this.cache ? this.cache.status.location : undefined,
      chargeLimit:
        chargeLimit && chargeLimit.acPercent > 0 ? chargeLimit : this.cache ? this.cache.status.chargeLimit : undefined,
    }
  }

  protected async getCarStatus(id: string, forceUpdate: boolean, _location: boolean = false): Promise<BluelinkStatus> {
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
      this.setLastCommandSent()
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
      ...(config.seatClimateOption &&
        isNotEmptyObject(config.seatClimateOption) && {
          seatClimateInfo: {
            drvSeatClimateState: config.seatClimateOption.driver,
            psgSeatClimateState: config.seatClimateOption.passenger,
            rlSeatClimateState: config.seatClimateOption.rearLeft,
            rrSeatClimateState: config.seatClimateOption.rearRight,
          },
        }),
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
    retryWithNoSeat = false,
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
      this.setLastCommandSent()
      const transactionId = resp.json.msgId // SID or msgId
      if (transactionId) return await this.pollForCommandCompletion(id, transactionId)
    } else {
      // Kia/Hyundai US seems pretty particular with seat settings, hence if fail retry without them,
      if (!retryWithNoSeat && climateRequest.seatClimateInfo) {
        delete climateRequest.seatClimateInfo
        return this.climateStartStop(id, climateRequest, true)
      }
    }
    const error = `Failed to send climateOff command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
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
        Stamp: this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb),
        ccuCCS2ProtocolSupport: this.getCCS2Header(),
      },
      validResponseFunction: this.requestResponseValid,
    })
    if (this.requestResponseValid(resp.resp, resp.json).valid) {
      this.setLastCommandSent()
      // polling seemingly not an option for Europe - return the result of a force update (which itself can poll)
      return {
        isSuccess: true,
        data: await this.getCarStatus(id, true),
      }
    }
    const error = `Failed to send chargeLimit command: ${JSON.stringify(resp.json)} request ${JSON.stringify(this.debugLastRequest)}`
    if (this.config.debugLogging) this.logger.log(error)
    throw Error(error)
  }
}
