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
import { encryptPasswordWithRsaJwk } from './europe-crypto'

import { returnMockedCarStatus, returnMockedCar } from './mock'

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
  authClientSecret?: string
  authParam: string
  clientId: string
  pushType: string
  cciApiDomain: string
  cciClientId: string
  cciRedirectUri: string
  cciPackageId: string
  cciClientName: string
  cciClientOsVersion: string
  cciNotificationProvider: string
}

const API_CONFIG: Record<string, APIConfig> = {
  hyundai: {
    apiDomain: 'prd.eu-ccapi.hyundai.com',
    apiPort: 8080,
    appId: '014d2225-8495-4735-812d-2616334fd15d',
    authCfb: 'RFtoRq/vDXJmRndoZaZQyfOot7OrIqGVFj96iY2WL3yyH5Z/pUvlUhqmCxD2t+D65SQ=',
    authBasic:
      'Basic NmQ0NzdjMzgtM2NhNC00Y2YzLTk1NTctMmExOTI5YTk0NjU0OktVeTQ5WHhQekxwTHVvSzB4aEJDNzdXNlZYaG10UVI5aVFobUlGampvWTRJcHhzVg==',
    authHost: 'idpconnect-eu.hyundai.com',
    clientId: '6d477c38-3ca4-4cf3-9557-2a1929a94654',
    authParam: 'euhyundaiidm',
    authClientSecret: 'KUy49XxPzLpLuoK0xhBC77W6VXhmtQR9iQhmIFjjoY4IpxsV',
    pushType: 'GCM',
    cciApiDomain: 'cci-api-eu.hyundai.com',
    cciClientId: '4f4953b5-02e1-4dbc-8599-87e983ee1be5',
    cciRedirectUri: 'https://oneapp.hyundai.com/redirect',
    cciPackageId: 'com.hyundai.oneapp.eu',
    cciClientName: 'hyundai',
    cciClientOsVersion: '18.7',
    cciNotificationProvider: 'APNS',
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
    authClientSecret: 'secret',
    pushType: 'APNS',
    cciApiDomain: 'cci-api-eu.kia.com',
    cciClientId: '01b36c86-79e8-486c-8009-15f2ad88d670',
    cciRedirectUri: 'https://oneapp.kia.com/redirect',
    cciPackageId: 'com.kia.oneapp.eu',
    cciClientName: 'kia',
    cciClientOsVersion: '27',
    cciNotificationProvider: 'IOS_APPSTORE',
  },
}

const MOCK_API = false

const isDeviceIdError = (data: any): boolean => String(data?.resCode) === '4002'

export class BluelinkEurope extends Bluelink {
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

  static async init(config: Config, refreshAuth: boolean, vin?: string, statusCheckInterval?: number) {
    const obj = new BluelinkEurope(config, statusCheckInterval)
    await obj.superInit(config, refreshAuth)
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
    data: Record<string, any>,
  ): { valid: boolean; retry: boolean } {
    if (isDeviceIdError(data)) {
      return { valid: false, retry: true }
    }
    if (
      Object.hasOwn(resp, 'statusCode') &&
      (resp.statusCode === 200 || resp.statusCode === 204 || resp.statusCode === 302)
    ) {
      return { valid: true, retry: false }
    }
    return { valid: false, retry: true }
  }

  protected async recoverRequestForRetry(resp: Record<string, any>, data: any): Promise<void> {
    if (!isDeviceIdError(data)) {
      return await super.recoverRequestForRetry(resp, data)
    }

    const authId = await this.getDeviceId()
    if (!authId) {
      throw Error('Failed to refresh invalid device ID')
    }

    if (this.tokens) this.tokens.authId = authId
    if (this.cache) {
      this.cache.token.authId = authId
      this.saveCache()
    }
    this.controlToken = undefined
    if (this.config.debugLogging) this.logger.log('Refreshed invalid European device ID')
  }

  private async getReusableDeviceId(): Promise<string | undefined> {
    if (this.cache?.token?.authId) {
      return this.cache.token.authId
    }
    return await this.getDeviceId()
  }

  private mergeCookieHeaders(existing: string | undefined, incoming: string | undefined): string | undefined {
    const cookieMap = new Map<string, string>()
    for (const source of [existing, incoming]) {
      if (!source) continue
      for (const chunk of source.split(';')) {
        const trimmed = chunk.trim()
        if (!trimmed) continue
        const separatorIndex = trimmed.indexOf('=')
        if (separatorIndex <= 0) continue
        const name = trimmed.slice(0, separatorIndex).trim()
        const value = trimmed.slice(separatorIndex + 1).trim()
        if (name) cookieMap.set(name, value)
      }
    }

    const merged = Array.from(cookieMap.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ')
    return merged.length > 0 ? merged : undefined
  }

  private extractQueryParam(urlString: string, key: string): string | undefined {
    try {
      const parsed = Url.parse(urlString, true).query
      const value = parsed[key]
      return Array.isArray(value) ? value[0] : value
    } catch {
      return undefined
    }
  }

  private getBrandLabel(): string {
    return this.config.manufacturer === 'kia' ? 'Kia' : 'Hyundai'
  }

  private getCookieValue(cookies: string, name: string): string | undefined {
    for (const cookie of cookies.split(';')) {
      const [key, value] = cookie.trim().split('=', 2)
      if (key === name && value) return value
    }
    return undefined
  }

  private getCciHeaders(
    deviceId: string,
    tokens: Record<string, string> = {},
    contentType?: string,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'client-id': this.apiConfig.cciPackageId,
      'client-name': this.apiConfig.cciClientName,
      'client-version': '1.3.3',
      'client-os-code': 'ios',
      'client-os-version': this.apiConfig.cciClientOsVersion,
      'client-device-id': deviceId,
      'client-device-model': 'iPhone',
      'client-notification-provider-type': this.apiConfig.cciNotificationProvider,
      locale: 'EN',
      timezone: this.getTimeZoneFull(),
      Accept: 'application/json',
      'Accept-Language': 'en',
      'User-Agent': 'okhttp/3.14.9',
    }
    if (tokens.nonCcsToken) headers.Authentication = tokens.nonCcsToken
    if (tokens.cciAccessToken) headers.authorization = `Bearer ${tokens.cciAccessToken.replace(/^Bearer\s+/i, '')}`
    if (tokens.exchangeableAccessToken) {
      headers['exchangeable-token'] = tokens.exchangeableAccessToken
      headers['non-ccs-token'] = tokens.nonCcsToken || ''
    }
    if (contentType) headers['Content-Type'] = contentType
    else headers['Content-Length'] = '0'
    return headers
  }

  private getCcsExpiry(expiresTime: unknown): number {
    const expiry = Number(expiresTime)
    if (Number.isFinite(expiry) && expiry > 0) {
      return expiry > 100000000000 ? Math.floor(expiry / 1000) : Math.floor(expiry)
    }
    return Math.floor(Date.now() / 1000) + 3600
  }

  private getCciTokens(data: Record<string, any>, existing: Record<string, string> = {}): Record<string, string> {
    return {
      cciAccessToken: data.accessToken || existing.cciAccessToken || '',
      exchangeableAccessToken: data.exchangeableAccessToken || existing.exchangeableAccessToken || '',
      exchangeableRefreshToken: data.exchangeableRefreshToken || existing.exchangeableRefreshToken || '',
      nonCcsToken: data.nonCcsToken || existing.nonCcsToken || '',
      nonCcsRefreshToken: data.nonCcsRefreshToken || existing.nonCcsRefreshToken || '',
      idToken: data.idToken || existing.idToken || '',
    }
  }

  private async exchangeCciTokenForCcs(
    deviceId: string,
    refreshToken: string,
    additionalTokens: Record<string, string>,
  ): Promise<BluelinkTokens> {
    const resp = await this.request({
      url: `https://${this.apiConfig.cciApiDomain}/domain/api/v1/auth/token-exchange?serviceType=CCS`,
      method: 'POST',
      noAuth: true,
      disableAdditionalHeaders: true,
      validResponseFunction: this.requestResponseValid,
      headers: this.getCciHeaders(deviceId, additionalTokens),
    })
    const accessToken = resp.json.accessToken || resp.json.ccsAccessToken
    if (!this.requestResponseValid(resp.resp, resp.json).valid || !accessToken) {
      const error = `CCI CCS token exchange failed: HTTP ${resp.resp.statusCode} — ${JSON.stringify(resp.json)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    return {
      accessToken: `Bearer ${accessToken.replace(/^Bearer\s+/i, '')}`,
      refreshToken,
      expiry: this.getCcsExpiry(resp.json.expiresTime),
      authId: deviceId,
      additionalTokens,
    }
  }

  private async cciLoginWithPassword(): Promise<BluelinkTokens | undefined> {
    const host = this.apiConfig.authHost
    const deviceId = await this.getDeviceId()
    if (!deviceId) {
      throw Error(`Failed to register ${this.getBrandLabel()} device for CCI login`)
    }

    const clientId = this.apiConfig.cciClientId
    const redirectUri = this.apiConfig.cciRedirectUri
    const mobileUa = `${'Mozilla/5.0 (Linux; Android 4.1.1; Galaxy Nexus Build/JRO03C) AppleWebKit/535.19 (KHTML, like Gecko) Chrome/18.0.1025.166 Mobile Safari/535.19'}_CCS_APP_AOS`

    const respAuthorize = await this.request({
      url:
        `https://${host}/auth/api/v2/user/oauth2/authorize?` +
        [
          `response_type=${encodeURIComponent('code')}`,
          `client_id=${encodeURIComponent(clientId)}`,
          `redirect_uri=${encodeURIComponent(redirectUri)}`,
          `lang=${encodeURIComponent('en')}`,
          `state=${encodeURIComponent('ccsp')}`,
          `country=${encodeURIComponent('de')}`,
        ].join('&'),
      noAuth: true,
      notJSON: true,
      disableAdditionalHeaders: true,
      validResponseFunction: this.requestResponseValid,
      headers: {
        'User-Agent': mobileUa,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
    })

    const authorizeResponse = String(respAuthorize.json || '')
    if (
      !this.requestResponseValid(respAuthorize.resp, {}).valid ||
      respAuthorize.resp.url?.includes('/error?status=400') ||
      authorizeResponse.toLowerCase().includes('abusing request')
    ) {
      const detail = authorizeResponse.toLowerCase().includes('abusing request')
        ? ' The IDPConnect authorization request was blocked by the server.'
        : ''
      const error = `Failed to initialize ${this.getBrandLabel()} login ${JSON.stringify(respAuthorize.resp)}`
      if (this.config.debugLogging) this.logger.log(error + detail)
      throw Error(error + detail)
    }

    const respCerts = await this.request({
      url: `https://${host}/auth/api/v1/accounts/certs`,
      noAuth: true,
      notJSON: true,
      disableAdditionalHeaders: true,
      validResponseFunction: this.requestResponseValid,
      headers: {
        'User-Agent': mobileUa,
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-GB,en;q=0.9',
        ...(respAuthorize.cookies && { Cookie: respAuthorize.cookies }),
      },
    })

    if (!this.requestResponseValid(respCerts.resp, {}).valid) {
      const error = `Failed to fetch ${this.getBrandLabel()} RSA certificate ${JSON.stringify(respCerts.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    let certPayload: Record<string, any>
    try {
      certPayload = JSON.parse(respCerts.json)
    } catch {
      const error = `Failed to parse ${this.getBrandLabel()} RSA certificate response ${respCerts.json}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    const jwk = certPayload.retValue || certPayload
    if (!jwk || !jwk.n || !jwk.e) {
      const error = `${this.getBrandLabel()} RSA certificate response missing key material ${JSON.stringify(certPayload)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    const encryptedPassword = encryptPasswordWithRsaJwk(this.config.auth.password, jwk)
    const cookieHeader = this.mergeCookieHeaders(respAuthorize.cookies, respCerts.cookies)
    const signinBody = [
      `client_id=${encodeURIComponent(clientId)}`,
      `encryptedPassword=${encodeURIComponent('true')}`,
      `password=${encodeURIComponent(encryptedPassword.encryptedPasswordHex)}`,
      `redirect_uri=${encodeURIComponent(redirectUri)}`,
      `scope=${encodeURIComponent('')}`,
      `nonce=${encodeURIComponent('')}`,
      `state=${encodeURIComponent('ccsp')}`,
      `username=${encodeURIComponent(this.config.auth.username)}`,
      `connector_session_key=${encodeURIComponent('')}`,
      `kid=${encodeURIComponent(encryptedPassword.kid || jwk.kid || '')}`,
      `_csrf=${encodeURIComponent('')}`,
    ].join('&')

    const respSignin = await this.request({
      url: `https://${host}/auth/account/signin`,
      method: 'POST',
      data: signinBody,
      noAuth: true,
      notJSON: true,
      noRedirect: true,
      disableAdditionalHeaders: true,
      validResponseFunction: this.requestResponseValid,
      headers: {
        'User-Agent': mobileUa,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(cookieHeader && { Cookie: cookieHeader }),
      },
    })

    if (!this.requestResponseValid(respSignin.resp, {}).valid || respSignin.resp.statusCode !== 302) {
      const error = `Signin failed: HTTP ${respSignin.resp.statusCode} - ${JSON.stringify(respSignin.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    const location = this.caseInsensitiveParamExtraction('location', respSignin.resp.headers)
    if (!location) {
      const error = `Signin failed: missing redirect location ${JSON.stringify(respSignin.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    const authCode = this.extractQueryParam(location, 'code')
    if (!authCode) {
      if (location.includes('error')) {
        const errorDesc = this.extractQueryParam(location, 'error_description') || 'unknown'
        throw Error(`Authentication rejected: ${errorDesc}. Check username and password.`)
      }
      if (location.includes('/web/v1/user/authorization')) {
        throw Error(
          'Account consent is required. Please log in via a browser once to accept the terms, then use the refresh token.',
        )
      }
      if (location.includes('authorize')) {
        throw Error('Authentication failed - returned to login page. Check username and password.')
      }
      throw Error(`API error: unexpected redirect after signin: ${location.slice(0, 250)}`)
    }

    const respTokens = await this.request({
      url: `https://${this.apiConfig.cciApiDomain}/domain/api/v1/auth/token?code=${encodeURIComponent(authCode)}`,
      method: 'POST',
      noAuth: true,
      disableAdditionalHeaders: true,
      validResponseFunction: this.requestResponseValid,
      headers: this.getCciHeaders(deviceId),
    })

    if (!this.requestResponseValid(respTokens.resp, respTokens.json).valid || !respTokens.json.refreshToken) {
      const error = `CCI token exchange failed: HTTP ${respTokens.resp.statusCode} — ${JSON.stringify(respTokens.json)}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(error)
    }

    return await this.exchangeCciTokenForCcs(deviceId, respTokens.json.refreshToken, this.getCciTokens(respTokens.json))
  }

  private async loginWithPassword(): Promise<BluelinkTokens | undefined> {
    if (/^[A-Z0-9]{48}$/.test(this.config.auth.password)) {
      return await this.idpRefreshTokensExact(this.config.auth.password)
    }
    return await this.cciLoginWithPassword()
  }

  protected async login(): Promise<BluelinkTokens | undefined> {
    return await this.loginWithPassword()
  }

  private async idpRefreshTokensExact(refreshToken: string): Promise<BluelinkTokens | undefined> {
    if (!refreshToken) {
      if (this.config.debugLogging) this.logger.log('No refresh token - cannot refresh')
      return undefined
    }

    const resp = await this.request({
      url: `https://${this.apiConfig.authHost}/auth/api/v2/user/oauth2/token`,
      data: [
        'grant_type=refresh_token',
        `refresh_token=${encodeURIComponent(refreshToken)}`,
        `client_id=${encodeURIComponent(this.apiConfig.clientId)}`,
        `client_secret=${encodeURIComponent(this.apiConfig.authClientSecret || '')}`,
      ].join('&'),
      noAuth: true,
      disableAdditionalHeaders: true,
      validResponseFunction: this.requestResponseValid,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })

    if (!this.requestResponseValid(resp.resp, resp.json).valid || resp.resp.statusCode !== 200) {
      const error = `API error: token refresh failed: HTTP ${resp.resp.statusCode} — ${JSON.stringify(resp.resp)}`
      if (this.config.debugLogging) this.logger.log(error)
      return undefined
    }

    return {
      accessToken: `${resp.json.token_type} ${resp.json.access_token}`,
      refreshToken: resp.json.refresh_token || refreshToken,
      expiry: Math.floor(Date.now() / 1000) + Number(resp.json.expires_in),
      authId: this.cache?.token?.authId || (await this.getReusableDeviceId()) || '',
    }
  }

  private async refreshCciTokens(): Promise<BluelinkTokens | undefined> {
    const cachedTokens = this.cache.token.additionalTokens
    const deviceId = this.cache.token.authId
    const refreshToken = this.cache.token.refreshToken
    if (!cachedTokens || !deviceId || !refreshToken) return undefined

    const resp = await this.request({
      url: `https://${this.apiConfig.cciApiDomain}/domain/api/v2/auth/token-refresh`,
      method: 'POST',
      data: JSON.stringify({
        accessToken: cachedTokens.cciAccessToken || '',
        refreshToken,
        exchangeableAccessToken: cachedTokens.exchangeableAccessToken || '',
        exchangeableRefreshToken: cachedTokens.exchangeableRefreshToken || '',
        nonCcsToken: cachedTokens.nonCcsToken || '',
        nonCcsRefreshToken: cachedTokens.nonCcsRefreshToken || '',
        idToken: cachedTokens.idToken || '',
      }),
      noAuth: true,
      disableAdditionalHeaders: true,
      validResponseFunction: this.requestResponseValid,
      headers: this.getCciHeaders(deviceId, cachedTokens, 'application/json'),
    })
    if (!this.requestResponseValid(resp.resp, resp.json).valid) {
      const error = `CCI token refresh failed: HTTP ${resp.resp.statusCode} — ${JSON.stringify(resp.json)}`
      if (this.config.debugLogging) this.logger.log(error)
      return undefined
    }

    const additionalTokens = this.getCciTokens(resp.json, cachedTokens)
    const refreshedCookie = this.getCookieValue(resp.cookies, 't')
    if (refreshedCookie) additionalTokens.exchangeableAccessToken = refreshedCookie
    return await this.exchangeCciTokenForCcs(deviceId, resp.json.refreshToken || refreshToken, additionalTokens)
  }

  protected async refreshTokens(): Promise<BluelinkTokens | undefined> {
    if (!this.cache || !this.cache.token.refreshToken) {
      if (this.config.debugLogging) this.logger.log('No refresh token - cannot refresh')
      return undefined
    }

    if (this.cache.token.additionalTokens?.cciAccessToken) {
      try {
        return await this.refreshCciTokens()
      } catch (error) {
        if (this.config.debugLogging) this.logger.log(`CCI token refresh failed: ${error}`)
        return undefined
      }
    }
    return await this.idpRefreshTokensExact(this.cache.token.refreshToken)
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
    if (MOCK_API) return returnMockedCar()
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
        let matchedVehicle = undefined
        for (const v of resp.json.resMsg.vehicles) {
          if (v.vin === vin) {
            matchedVehicle = v
            break
          }
        }
        if (!matchedVehicle) {
          const cachedVehicle = this.getCachedCarForVin(vin)
          if (cachedVehicle) {
            if (this.config.debugLogging)
              this.logger.log(`Configured VIN ${vin} not found in vehicle list, using cached car`)
            return cachedVehicle
          }
          const error = `Configured VIN ${vin} not found in vehicle list`
          if (this.config.debugLogging) this.logger.log(error)
          throw Error(error)
        }
        vehicle = matchedVehicle
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
    if (MOCK_API) return returnMockedCarStatus()
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
