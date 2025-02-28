import { Config } from '../../config'
import { defaultImage } from '../../resources/defaultImage'
import { Logger } from '../logger'
import { Buffer } from 'buffer'
const KEYCHAIN_CACHE_KEY = 'egmp-bluelink-cache'
export const DEFAULT_STATUS_CHECK_INTERVAL = 3600 * 1000
export const MAX_COMPLETION_POLLS = 20
const BLUELINK_LOG_FILE = 'egmp-bluelink.log'
const DEFAULT_API_HOST = 'mybluelink.ca'
const DEFAULT_API_DOMAIN = `https://${DEFAULT_API_HOST}/tods/api/`

export interface BluelinkTokens {
  accessToken: string
  refreshToken?: string
  expiry: number
  authCookie?: string
  authId?: string
}

export interface BluelinkCar {
  id: string
  vin: string
  nickName: string
  modelName: string
  modelYear: string
  modelTrim?: string
  modelColour?: string
  odometer?: number
  europeccs2?: number
}

export interface BluelinkStatus {
  lastStatusCheck: number
  lastRemoteStatusCheck: number
  isCharging: boolean
  isPluggedIn: boolean
  chargingPower: number
  remainingChargeTimeMins: number
  range: number
  locked: boolean
  climate: boolean
  soc: number
  twelveSoc: number
  odometer: number
}

export interface Status {
  car: BluelinkCar
  status: BluelinkStatus
}

export interface Cache {
  token: BluelinkTokens
  car: BluelinkCar
  status: BluelinkStatus
}

export interface RequestProps {
  url: string
  data?: string
  method?: string
  noAuth?: boolean
  headers?: Record<string, string>
  validResponseFunction: (resp: Record<string, any>, data: Record<string, any>) => { valid: boolean; retry: boolean }
  noRetry?: boolean
  notJSON?: boolean
  noRedirect?: boolean
  authTokenOverride?: string
}

export interface DebugLastRequest {
  url: string
  method: string
  data?: string
  headers: Record<string, string>
}

export interface TempConversion {
  F: number[]
  C: number[]
  H: string[]
}

export interface ClimateRequest {
  enable: boolean
  frontDefrost: boolean
  rearDefrost: boolean
  steering: boolean
  temp: number
  durationMinutes: number
}

const carImageHttpURL = 'https://bluelink.andyfase.com/app-assets/car-images/'
const carImageMap: Record<string, string> = {
  'ioniq 5': 'ioniq5.png',
  'ioniq 5 n': 'ioniq5n.png',
  'ioniq 6': 'ioniq6.png',
  ev6: 'ev6.png',
  ev9: 'ev9.png',
  kona: 'kona.png',
  default: 'ioniq5.png',
}

export class Bluelink {
  // @ts-ignore - config is initalized in init
  protected config: Config
  // @ts-ignore - cache is initalized in init
  protected cache: Cache
  protected vin: string | undefined
  protected statusCheckInterval: number
  protected apiHost: string
  protected apiDomain: string

  protected additionalHeaders: Record<string, string>
  protected authHeader: string
  protected tempLookup: TempConversion | undefined
  protected tokens: BluelinkTokens | undefined
  protected authIdHeader: string | undefined
  protected debugLastRequest: DebugLastRequest | undefined
  protected logger: any
  protected loginFailure: boolean
  protected distanceUnit: string

  constructor(config: Config, vin?: string) {
    this.config = config
    this.vin = vin
    this.apiDomain = DEFAULT_API_DOMAIN
    this.apiHost = DEFAULT_API_HOST
    this.statusCheckInterval = DEFAULT_STATUS_CHECK_INTERVAL
    this.additionalHeaders = {}
    this.authHeader = 'Authentication'
    this.tokens = undefined
    this.loginFailure = false
    this.debugLastRequest = undefined
    this.tempLookup = undefined
    this.authIdHeader = undefined
    this.distanceUnit = 'km'
    this.logger = new Logger(BLUELINK_LOG_FILE, 100)
  }

  protected async superInit(config: Config, statusCheckInterval?: number) {
    this.vin = this.config.vin
    this.statusCheckInterval = statusCheckInterval || DEFAULT_STATUS_CHECK_INTERVAL

    // loadCache will login user if the cache doesnt exist i.e first app use
    const cache = await this.loadCache()
    if (!cache) {
      this.loginFailure = true
      return
    }
    this.cache = cache
    await this.refreshLogin()
  }

  protected async refreshLogin(force?: boolean) {
    // if we are here we have logged in successfully at least once and can refresh if supported
    if (force || !this.tokenValid()) {
      let tokens = undefined
      if (typeof (this as any).refreshTokens === 'function') {
        // @ts-ignore - this is why we check the sub-class has this as its not always implemented
        tokens = await this.refreshTokens()
        if (!tokens) {
          tokens = await this.login() // fallback to normal login if refresh fails
        }
      } else {
        tokens = await this.login()
      }

      if (!tokens) this.loginFailure = true
      else {
        this.tokens = tokens as BluelinkTokens
        this.cache.token = this.tokens
        this.saveCache()
      }
    }
  }

  protected getStamp(appId: string, cfb: string): string {
    const rawData = `${appId}:${Math.floor(Date.now() / 1000)}`
    const rawDataBytes = Buffer.from(rawData, 'utf-8')
    const rawCfbBytes = Buffer.from(cfb, 'utf-8')
    const result = new Uint8Array(rawDataBytes.length)

    for (const [i, byte] of rawDataBytes.entries()) {
      if (i <= rawCfbBytes.length) result[i] = byte ^ rawCfbBytes[i]! //
    }
    return Buffer.from(result).toString('base64')
  }

  protected genRanHex(size: number): string {
    return [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')
  }

  protected getTimeZone(): string {
    const offset = new Date().getTimezoneOffset(),
      o = Math.abs(offset)
    return (offset < 0 ? '+' : '-') + ('00' + Math.floor(o / 60)).slice(-2) + ':' + ('00' + (o % 60)).slice(-2)
  }

  protected getApiDomain(lookup: string, domains: Record<string, string>, _default: string): string {
    for (const [key, domain] of Object.entries(domains)) {
      if (key === lookup) return domain
    }
    return _default
  }

  protected getHeatingValue(rearDefrost: boolean, steering: boolean): number {
    // 0 = None
    // 2 = Back Defroster only
    // 3 = Steering Wheel only
    // 4 = Steering and Defroster
    if (!rearDefrost && !steering) return 0
    if (rearDefrost && steering) return 4
    if (rearDefrost) return 2
    if (steering) return 3
    return 0 // default
  }

  public getDistanceUnit(): string {
    return this.distanceUnit
  }

  public loginFailed(): boolean {
    return this.loginFailure
  }

  public getCachedStatus(): Status {
    return {
      car: this.cache.car,
      status: this.cache.status,
    }
  }

  public async getStatus(forceUpdate: boolean, noCache: boolean): Promise<Status> {
    if (forceUpdate) {
      this.cache.status = await this.getCarStatus(this.cache.car.id, true)
      this.cache.car = await this.getCar()
      this.saveCache()
    } else if (noCache || this.cache.status.lastStatusCheck + this.statusCheckInterval < Date.now()) {
      this.cache.status = await this.getCarStatus(this.cache.car.id, false)
      this.saveCache()
    }
    return {
      car: this.cache.car,
      status: this.cache.status,
    }
  }

  public async processRequest(
    type: string,
    input: any,
    callback: (isComplete: boolean, didSucceed: boolean, input: any | undefined) => void,
  ) {
    let promise: Promise<any> | undefined = undefined
    let data: any | undefined = undefined
    let didSucceed = false
    switch (type) {
      case 'status':
        promise = this.getStatus(true, true)
        break
      case 'lock':
        promise = this.lock(this.cache.car.id)
        break
      case 'unlock':
        promise = this.unlock(this.cache.car.id)
        break
      case 'startCharge':
        promise = this.startCharge(this.cache.car.id)
        break
      case 'stopCharge':
        promise = this.stopCharge(this.cache.car.id)
        break
      case 'climate': {
        if (!input) {
          throw Error('Must provide valid input for climate request!')
        }
        const inputClimate = input as ClimateRequest
        promise = inputClimate.enable ? this.climateOn(this.cache.car.id, input) : this.climateOff(this.cache.car.id)
        break
      }
      default:
        throw Error(`Unsupported request ${type}`)
    }
    let hasRequestCompleted = false
    const timer = Timer.schedule(500, true, async () => {
      if (!hasRequestCompleted) {
        callback(false, false, undefined)
      } else {
        timer.invalidate()
        if (this.config.debugLogging) this.logger.log(`Returning poll completion ${didSucceed}, data: ${data}`)
        callback(true, didSucceed, data)
      }
    })

    try {
      data = await promise
      hasRequestCompleted = true
      if (type === 'status') {
        didSucceed = true
        data = data as Status
      } else {
        data = data as { isSuccess: boolean; data: BluelinkStatus }
        didSucceed = data.isSuccess
        data = data.data
      }
    } catch (error) {
      const e = error as Error
      hasRequestCompleted = true
      didSucceed = false
      data = e
    }
  }

  public getConfig() {
    return this.config
  }

  public deleteCache() {
    Keychain.remove(KEYCHAIN_CACHE_KEY)
  }

  protected saveCache() {
    Keychain.set(KEYCHAIN_CACHE_KEY, JSON.stringify(this.cache))
  }

  protected async loadCache(): Promise<Cache | undefined> {
    let cache: Cache | undefined = undefined
    if (Keychain.contains(KEYCHAIN_CACHE_KEY)) {
      cache = JSON.parse(Keychain.get(KEYCHAIN_CACHE_KEY))
    }
    if (!cache) {
      // initial use - load car and status
      const tokens = await this.login()
      if (!tokens) {
        this.loginFailure = true
        return
      }
      this.tokens = tokens
      const car = await this.getCar()
      cache = {
        token: this.tokens,
        car: car,
        status: await this.getCarStatus(car.id, false),
      }
    }
    this.cache = cache
    this.saveCache()
    return this.cache
  }

  protected tokenValid(): boolean {
    // invalid if within 30 seconds of expiry
    return Boolean(this.cache.token.expiry - 30 > Math.floor(Date.now() / 1000))
  }

  protected nextRequestCookies(req: Request): string {
    let cookies = ''
    if (req.response.cookies) {
      for (const cookie of req.response.cookies) {
        cookies = cookies + `${cookie.name}=${cookie.value}; `
      }
      cookies = cookies.slice(0, -2)
    }
    return cookies
  }

  protected async request(props: RequestProps): Promise<{ resp: { [key: string]: any }; json: any; cookies: string }> {
    let requestTokens: BluelinkTokens | undefined = undefined
    if (!props.noAuth) {
      requestTokens = this.tokens ? this.tokens : this.cache.token
    }
    if (!props.noAuth && !requestTokens) {
      throw Error('No tokens available for request')
    }

    const req = new Request(props.url)
    req.method = props.method ? props.method : props.data ? 'POST' : 'GET'
    req.headers = {
      Accept: 'application/json, text/plain, */*',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'en-US,en;q=0.9',
      ...(props.data &&
        !(props.headers && props.headers['Content-Type']) && {
          'Content-Type': 'application/json',
        }),
      ...(!props.noAuth &&
        requestTokens &&
        requestTokens.accessToken && {
          [this.authHeader]: props.authTokenOverride ? props.authTokenOverride : requestTokens.accessToken,
        }),
      ...(!props.noAuth &&
        requestTokens &&
        requestTokens.authCookie && {
          Cookie: requestTokens.authCookie,
        }),
      ...(!props.noAuth &&
        requestTokens &&
        requestTokens.authId &&
        this.authIdHeader && {
          [this.authIdHeader]: requestTokens.authId,
        }),
      ...this.additionalHeaders,
      ...(props.headers && {
        ...props.headers,
      }),
    }
    if (props.data) {
      req.body = props.data
    }
    if (props.noRedirect) {
      // @ts-ignore - returning null is allowed
      req.onRedirect = (_request) => {
        this.logger.log('in redirect')
        return null
      }
    }
    req.allowInsecureRequest = true
    this.debugLastRequest = {
      url: props.url,
      method: req.method,
      headers: req.headers,
      ...(props.data && {
        data: req.body,
      }),
    }
    try {
      if (this.config.debugLogging) this.logger.log(`Sending request ${JSON.stringify(this.debugLastRequest)}`)
      const json = !props.notJSON ? await req.loadJSON() : await req.loadString()
      if (this.config.debugLogging)
        this.logger.log(
          `response ${JSON.stringify(req.response)} data: ${!props.notJSON ? JSON.stringify(json) : 'not JSON'}`,
        )

      const checkResponse = props.validResponseFunction(req.response, json)
      if (!props.noRetry && checkResponse.retry && !props.noAuth) {
        // re-auth and call ourselves
        await this.refreshLogin(true)
        return await this.request({
          ...props,
          noRetry: true,
        })
      }
      return { resp: req.response, json: json, cookies: this.nextRequestCookies(req) }
    } catch (error) {
      const errorString = `Failed to send request to ${props.url}, request ${JSON.stringify(this.debugLastRequest)} - error ${error}`
      if (this.config.debugLogging) this.logger.log(error)
      throw Error(errorString)
    }
  }

  public async getCarImage(): Promise<Image> {
    let carFileName = ''
    for (const [name, fileName] of Object.entries(carImageMap)) {
      if (this.cache.car.modelName.toLocaleLowerCase().includes(name)) {
        carFileName = fileName
        break
      }
    }
    if (!carFileName) carFileName = carImageMap['default']!

    const fs = FileManager.local()
    const localFilePath = `${fs.libraryDirectory()}/${carFileName}`
    if (fs.fileExists(localFilePath)) {
      return fs.readImage(localFilePath)
    }

    // download and store image
    const req = new Request(`${carImageHttpURL}/${carFileName}`)
    req.method = 'GET'

    try {
      const image = await req.loadImage()
      fs.writeImage(localFilePath, image)
      return image
    } catch (_error) {
      // failed download - return low quality local default image which is base64 encoded
      return Image.fromData(Data.fromBase64String(defaultImage))
    }
  }

  protected async sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      Timer.schedule(milliseconds, false, () => resolve())
    })
  }

  // helper function to extract a parameter from header / cookie etc - as the Bluelink API changes case frequently
  protected caseInsensitiveParamExtraction(key: string, data: Record<string, any>): string | undefined {
    if (Object.hasOwn(data, key)) return data[key] // check for exact match first

    const lowerKey = key.toLowerCase()
    for (const [k, v] of Object.entries(data)) {
      if (lowerKey === k.toLowerCase()) return v
    }
    return undefined
  }

  protected async login(): Promise<BluelinkTokens | undefined> {
    // implemented in country specific sub-class
    throw Error('Not Implemented')
  }

  protected async getCarStatus(_id: string, _forceUpdate: boolean): Promise<BluelinkStatus> {
    // implemented in country specific sub-class
    throw Error('Not Implemented')
  }

  protected async getCar(): Promise<BluelinkCar> {
    // implemented in country specific sub-class
    throw Error('Not Implemented')
  }

  protected async lock(_id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    // implemented in country specific sub-class
    throw Error('Not Implemented')
  }

  protected async unlock(_id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    // implemented in country specific sub-class
    throw Error('Not Implemented')
  }

  protected async startCharge(_id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    // implemented in country specific sub-class
    throw Error('Not Implemented')
  }

  protected async stopCharge(_id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    // implemented in country specific sub-class
    throw Error('Not Implemented')
  }

  protected async climateOn(
    _id: string,
    _config: ClimateRequest,
  ): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    // implemented in country specific sub-class
    throw Error('Not Implemented')
  }

  protected async climateOff(_id: string): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    // implemented in country specific sub-class
    throw Error('Not Implemented')
  }
}
