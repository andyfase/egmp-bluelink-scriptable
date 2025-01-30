import { Config } from '../../config'
import { defaultImage } from '../../resources/defaultImage'
import PersistedLog from '../scriptable-utils/io/PersistedLog'
const KEYCHAIN_CACHE_KEY = 'egmp-bluelink-cache'
export const DEFAULT_STATUS_CHECK_INTERVAL = 3600 * 1000
const BLUELINK_LOG_FILE = 'egmp-bluelink-log'
const DEFAULT_API_DOMAIN = 'https://mybluelink.ca/tods/api/'

export interface BluelinkTokens {
  accessToken: string
  expiry: number
}

export interface BluelinkCar {
  id: string
  vin: string
  nickName: string
  modelName: string
  modelYear: string
  modelTrim: string
  modelColour: string
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
  defrost: boolean
  steering: boolean
  temp: number
  durationMinutes: number
}

const carImageHttpURL = 'https://bluelink.andyfase.com/app-assets/car-images/'
const carImageMap: Record<string, string> = {
  'ioniq 5': 'ioniq5.png',
  ev6: 'ev6.png',
  default: 'ioniq5.png',
}

export class Bluelink {
  // @ts-ignore - config is initalized in init
  protected config: Config
  // @ts-ignore - cache is initalized in init
  protected cache: Cache
  protected vin: string | undefined
  protected statusCheckInterval: number
  protected apiDomain: string

  protected additionalHeaders: Record<string, string>
  protected authHeader: string
  protected tempLookup: TempConversion | undefined
  protected tokens: BluelinkTokens | undefined
  protected debugLastRequest: DebugLastRequest | undefined
  protected logger: any
  protected loginFailure: boolean

  constructor(config: Config, vin?: string) {
    this.vin = vin
    this.apiDomain = DEFAULT_API_DOMAIN
    this.statusCheckInterval = DEFAULT_STATUS_CHECK_INTERVAL
    this.additionalHeaders = {}
    this.authHeader = 'Authentication'
    this.tokens = undefined
    this.loginFailure = false
    this.debugLastRequest = undefined
    this.tempLookup = undefined
    this.logger = PersistedLog(BLUELINK_LOG_FILE)
  }

  protected async superInit(config: Config, statusCheckInterval?: number) {
    this.config = config
    this.vin = this.config.vin
    this.statusCheckInterval = statusCheckInterval || DEFAULT_STATUS_CHECK_INTERVAL

    const cache = await this.loadCache()
    if (!cache) {
      this.loginFailure = true
      return
    }
    this.cache = cache
    if (!this.tokenValid()) {
      const tokens = await this.login()
      if (!tokens) this.loginFailure = true
      else {
        this.tokens = tokens
        this.saveCache()
      }
    }
  }

  protected getApiDomain(lookup: string, domains: Record<string, string>, _default: string): string {
    for (const [key, domain] of Object.entries(domains)) {
      if (key === lookup) return domain
    }
    return _default
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
    return this.cache.token.expiry - 30 > Math.floor(Date.now() / 1000)
  }

  protected async request(props: RequestProps): Promise<{ resp: { [key: string]: any }; json: any }> {
    const req = new Request(props.url)
    req.method = props.method ? props.method : props.data ? 'POST' : 'GET'
    req.headers = {
      Accept: 'application/json',
      ...(props.data && {
        'Content-Type': 'application/json',
      }),
      ...(!props.noAuth && {
        [this.authHeader]: this.tokens ? this.tokens?.accessToken : this.cache.token.accessToken,
      }),
      ...this.additionalHeaders,
      ...(props.headers && {
        ...props.headers,
      }),
    }
    if (props.data) {
      req.body = props.data
    }

    this.debugLastRequest = {
      url: props.url,
      method: req.method,
      headers: req.headers,
      ...(props.data && {
        data: req.body,
      }),
    }
    try {
      const json = await req.loadJSON()
      return { resp: req.response, json: json }
    } catch (error) {
      await this.logger.log(`Failed to send request to ${props.url}, error ${error}`)
      throw Error(`Failed to send request to ${props.url}, error ${error}`)
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
