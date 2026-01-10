import { Config } from '../../config'
import { defaultImage } from '../../resources/defaultImage'
import { Logger } from '../logger'
import { Buffer } from 'buffer'
const KEYCHAIN_CACHE_KEY = 'egmp-bluelink-cache'
export const DEFAULT_STATUS_CHECK_INTERVAL = 3600 * 1000
export const MAX_COMPLETION_POLLS = 20
const BLUELINK_LOG_FILE = `${Script.name().replaceAll(' ', '')}-api.log`
const DEFAULT_API_HOST = 'mybluelink.ca'
const DEFAULT_API_DOMAIN = `https://${DEFAULT_API_HOST}/tods/api/`

export interface BluelinkTokens {
  accessToken: string
  refreshToken?: string
  expiry: number
  authCookie?: string
  authId?: string
  additionalTokens?: Record<string, string>
}

export interface CarOption {
  vin: string
  nickName: string
  modelName: string
  modelYear: string
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
  chargeLimit?: ChargeLimit
  location?: Location
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
  disableAdditionalHeaders?: boolean
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

export interface SeatClimate {
  driver: number
  passenger: number
  rearLeft: number
  rearRight: number
}

export interface ClimateRequest {
  enable: boolean
  frontDefrost: boolean
  rearDefrost: boolean
  steering: boolean
  temp: number
  durationMinutes: number
  seatClimateOption?: SeatClimate
}

export interface ChargeLimit {
  acPercent: number
  dcPercent: number
}

export interface Location {
  latitude: string
  longitude: string
}

const carImageHttpURL = 'https://bluelink.andyfase.com/app-assets/car-images/'
const carImageMap: Record<string, string> = {
  ioniq9: 'ioniq9',
  ioniq5n: 'ioniq5n',
  ioniq5: 'ioniq5',
  ioniq6: 'ioniq6',
  ioniq: 'ioniq',
  ev6: 'ev6',
  ev9: 'ev9',
  kona: 'kona',
  niro: 'niro',
  default: 'ioniq5',
}

export function getBluelinkLogger() {
  return new Logger(BLUELINK_LOG_FILE, 100)
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
  protected loginRequiredWebview: boolean
  protected carOptions: CarOption[]
  protected distanceUnit: string
  protected lastCommandSent: number | undefined

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
    this.loginRequiredWebview = false
    this.carOptions = []
    this.debugLastRequest = undefined
    this.tempLookup = undefined
    this.authIdHeader = undefined
    this.distanceUnit = 'km'
    this.logger = getBluelinkLogger()
  }

  protected async superInit(config: Config, refreshAuth: boolean, statusCheckInterval?: number) {
    this.vin = this.config.vin
    this.statusCheckInterval = statusCheckInterval || DEFAULT_STATUS_CHECK_INTERVAL

    // check for cache - if not this is first login
    const existingCache = this.cacheExists()
    // loadCache will login user if the cache doesnt exist i.e first app use
    const cache = await this.loadCache()
    if (!cache) {
      this.loginFailure = true
      return
    }
    this.cache = cache
    if (existingCache && refreshAuth) await this.refreshLogin()
  }

  // this can be overridden in sub-classes to perfporm additional header manupulation
  protected getAdditionalHeaders(): Record<string, string> {
    return this.additionalHeaders
  }

  protected async refreshLogin(force?: boolean) {
    if (!this.cache) return // we have no cache - likely failed on first load - ignore
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
        if (this.cache) {
          this.cache.token = this.tokens
          this.saveCache()
        }
      }
    }
  }

  protected getStamp(appId: string, cfbB64: string): string {
    const rawData = `${appId}:${Math.floor(Date.now() / 1000)}`
    const rawDataBytes = Buffer.from(rawData, 'utf-8')
    const cfbBytes = Buffer.from(cfbB64, 'base64')
    const minLen = Math.min(rawDataBytes.length, cfbBytes.length)
    const result = Buffer.alloc(minLen)

    for (let i = 0; i < minLen; i++) {
      result[i] = rawDataBytes[i]! ^ cfbBytes[i]!
    }
    return result.toString('base64')
  }

  public getLogger(): Logger {
    return this.logger
  }

  protected genRanHex(size: number): string {
    return [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')
  }

  protected getTimeZone(): string {
    const offset = new Date().getTimezoneOffset()
    const o = Math.abs(offset)
    return (offset < 0 ? '+' : '-') + ('0' + Math.floor(o / 60)).slice(-1)
  }

  protected getTimeZoneFull(): string {
    const offset = new Date().getTimezoneOffset()
    const o = Math.abs(offset)
    return (offset < 0 ? '+' : '-') + ('0' + Math.floor(o / 60)) + ':00'
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

  protected setLastCommandSent() {
    this.lastCommandSent = Date.now()
  }

  protected defaultNoEVStatus(
    lastRemoteCheck: Date,
    status: any,
    forceUpdate: boolean,
    odometer?: number,
    chargeLimit?: ChargeLimit,
    location?: Location,
  ): BluelinkStatus {
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
      twelveSoc: status.battery && status.battery.batSoc ? status.battery.batSoc : 0,
      odometer: odometer ? odometer : this.cache ? this.cache.status.odometer : 0,
      location: location ? location : this.cache ? this.cache.status.location : undefined,
      chargeLimit:
        chargeLimit && chargeLimit.acPercent > 0 ? chargeLimit : this.cache ? this.cache.status.chargeLimit : undefined,
    }
  }

  public getDistanceUnit(): string {
    return this.distanceUnit
  }

  public getLastCommandSent(): number | undefined {
    return this.lastCommandSent
  }

  public getCarOptions(): CarOption[] {
    return this.carOptions
  }

  public loginFailed(): boolean {
    return this.loginFailure
  }

  public needRestart(): boolean {
    return this.loginRequiredWebview
  }

  public getCachedStatus(): Status {
    return {
      car: this.cache.car,
      status: this.cache.status,
    }
  }

  public async refreshAuth(force = false): Promise<void> {
    return await this.refreshLogin(force)
  }

  public async getStatus(forceUpdate: boolean, noCache: boolean, location: boolean = false): Promise<Status> {
    if (forceUpdate) {
      // getCar first then save then get remote status
      // widget remote refresh does not await for entire process to complete, and odometer in US is only on getCar calls, which need to complete and save to cache before sending remote status command
      // the remote status command will update the API servers in backgound - hence next normal status check will get the updated status data
      const car = await this.getCar()
      if (car) this.cache.car = car
      this.saveCache()
      this.setLastCommandSent()
      this.cache.status = await this.getCarStatus(this.cache.car.id, true, location)
      this.saveCache()
    } else if (noCache || this.cache.status.lastStatusCheck + this.statusCheckInterval < Date.now()) {
      this.cache.status = await this.getCarStatus(this.cache.car.id, false, location)
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
      case 'location':
        promise = this.getStatus(true, true, true)
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
      case 'chargeLimit': {
        if (!input) {
          throw Error('Must provide valid input for charge limit request!')
        }
        const inputChargeLimit = input as ChargeLimit
        promise = this.setChargeLimit(this.cache.car.id, inputChargeLimit)
        break
      }
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
      if (type === 'status' || type === 'location') {
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

  protected getCacheKey(write = false): string {
    const currentScript = Script.name().replaceAll(' ', '')
    const newCacheKey = `egmp-scriptable-bl-cache-${currentScript}`
    if (this.config.multiCar || write || Keychain.contains(newCacheKey)) return newCacheKey
    return KEYCHAIN_CACHE_KEY
  }

  public getConfig() {
    return this.config
  }

  public deleteCache(all = false) {
    Keychain.remove(this.getCacheKey(true))
    if (all) Keychain.remove(this.getCacheKey())
  }

  protected saveCache() {
    Keychain.set(this.getCacheKey(true), JSON.stringify(this.cache))
  }

  protected cacheExists(): boolean {
    return Keychain.contains(this.getCacheKey())
  }

  protected async loadCache(): Promise<Cache | undefined> {
    let cache: Cache | undefined = undefined
    if (Keychain.contains(this.getCacheKey())) {
      cache = JSON.parse(Keychain.get(this.getCacheKey()))
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
      if (!car) {
        this.loginFailure = true
        return
      }
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
      ...(this.getAdditionalHeaders() && !props.disableAdditionalHeaders && { ...this.getAdditionalHeaders() }),
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
        if (this.cache) await this.refreshLogin(true) // only refresh login if we have a cache - i.e not first login
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

  public async getCarImage(
    carColour: string = 'white',
    forceRefresh = false,
    retryDefaultOnFail = true,
    retryOriginalColour: string | undefined = undefined,
  ): Promise<Image> {
    let carFilePrefix = ''
    for (const [name, fileName] of Object.entries(carImageMap)) {
      if (this.cache.car.modelName.toLocaleLowerCase().replaceAll(' ', '').includes(name)) {
        carFilePrefix = fileName
        break
      }
    }
    if (!carFilePrefix) carFilePrefix = carImageMap['default']!

    const fs = FileManager.local()
    const localFilePath = retryOriginalColour
      ? `${fs.libraryDirectory()}/${carFilePrefix}_${retryOriginalColour}.png`
      : `${fs.libraryDirectory()}/${carFilePrefix}_${carColour}.png`
    if (!forceRefresh && fs.fileExists(localFilePath)) {
      return fs.readImage(localFilePath)
    }

    // download and store image
    const req = new Request(`${carImageHttpURL}/${carFilePrefix}/${carColour}.png`)
    req.method = 'GET'

    try {
      const image = await req.loadImage()
      fs.writeImage(localFilePath, image)
      return image
    } catch (_error) {
      // retry with white which always exists - save as requested colour so we dont keep retrying all the time.
      if (retryDefaultOnFail) return await this.getCarImage('white', false, false, carColour)
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

  protected async getCarStatus(
    _id: string,
    _forceUpdate: boolean,
    _location: boolean = false,
  ): Promise<BluelinkStatus> {
    // implemented in country specific sub-class
    throw Error('Not Implemented')
  }

  protected async getCar(): Promise<BluelinkCar | undefined> {
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

  protected async setChargeLimit(
    _id: string,
    _config: ChargeLimit,
  ): Promise<{ isSuccess: boolean; data: BluelinkStatus }> {
    // implemented in country specific sub-class
    throw Error('Not Implemented')
  }
}
