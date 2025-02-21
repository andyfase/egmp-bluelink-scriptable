import { Bluelink, BluelinkTokens, DEFAULT_STATUS_CHECK_INTERVAL } from './base'
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
}

const API_CONFIG: Record<string, APIConfig> = {
  hyundai: {
    apiDomain: 'prd.eu-ccapi.hyundai.com',
    apiPort: 8080,
    ccspServiceId: '6d477c38-3ca4-4cf3-9557-2a1929a94654',
    appId: 'dd1d2e03-f0b1-497d-9a80-3d3eeb141ae1',
    authCfb: b64decode('RFtoRq/vDXJmRndoZaZQyfOot7OrIqGVFj96iY2WL3yyH5Z/pUvlUhqmCxD2t+D65SQ='),
    authBasic:
      'Basic NmQ0NzdjMzgtM2NhNC00Y2YzLTk1NTctMmExOTI5YTk0NjU0OktVeTQ5WHhQekxwTHVvSzB4aEJDNzdXNlZYaG10UVI5aVFobUlGampvWTRJcHhzVg==',
    authHost: 'eu-account.hyundai.com',
    clientId: '6d477c38-3ca4-4cf3-9557-2a1929a94654',
    authClientID: '64621b96-0f0d-11ec-82a8-0242ac130003',
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
    }
    this.authHeader = 'accessToken'
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
    this.logger.log('starting login')
    const respReset = await this.request({
      url: `${this.apiDomain}/api/v1/user/oauth2/authorize?response_type=code&state=test&client_id=${this.apiConfig.clientId}&redirect_uri=${this.apiDomain}/api/v1/user/oauth2/redirect`,
      noAuth: true,
      notJSON: true,
      validResponseFunction: this.requestResponseValid,
    })

    this.logger.log('reset done')
    if (!this.requestResponseValid(respReset.resp, respReset.json).valid) {
      const error = `Failed to reset session ${JSON.stringify(respReset.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }
    // user user ID and Service ID
    const respIntegration = await this.request({
      url: `${this.apiDomain}/api/v1/user/integrationinfo`,
      noAuth: true,
      validResponseFunction: this.requestResponseValid,
    })
    this.logger.log('reset done')
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
    this.logger.log(`login form done ${respLoginForm.resp.url.startsWith(this.apiDomain)}`)
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
      this.logger.log(`login form: ${JSON.stringify(loginURL)}`)
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
      this.logger.log(`sessionCode: ${sessionCode} executionId: ${executionId} tabId: ${tabId}`)

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
      this.logger.log('login done')
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
    this.logger.log('lang done')
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
    this.logger.log('silent login done')
    if (!this.requestResponseValid(respLang.resp, respLang.json).valid) {
      const error = `Failed to perform silent login ${JSON.stringify(respLang.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    const redirectUrl = respSilent.json.redirectUrl
    this.logger.log(`redirect URL ${redirectUrl}`)
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
    this.logger.log(`auth code ${authCode} ${this.apiConfig.appId} ${this.apiConfig.authCfb}`)
    this.logger.log(`stamp ${this.getStamp(this.apiConfig.appId, this.apiConfig.authCfb)}`)

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
        'ccsp-service-id': this.apiConfig.ccspServiceId,
        'ccsp-application-id': this.apiConfig.appId,
      },
    })
    this.logger.log('tokens done')
    if (!this.requestResponseValid(respTokens.resp, respTokens.json).valid) {
      const error = `Failed to login ${JSON.stringify(respTokens.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    return {
      authCookie: '',
      accessToken: respTokens.json.access_token,
      refreshToken: respTokens.json.refresh_token,
      expiry: respTokens.json.expires_in,
    }
  }
}
