
import { ioniq5 } from "resources/images"

const KEYCHAIN_CACHE_KEY = "bluelink-cache"
const DEFAULT_STATUS_CHECK_INTERVAL = 3600

export interface BluelinkCreds {
  username: string
  password: string
  region: string
}

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
  lastRemoteStatusCheck: string
  isCharging: boolean
  chargingPower: number
  remainingChargeTimeMins: number 
  range: number
  locked: boolean
  conditioning: boolean
  soc: number
  twelveSoc: number
  odometer: number
}

export interface Status {
  car: BluelinkCar,
  status: BluelinkStatus
}

export interface Cache {
  token: BluelinkTokens
  car: BluelinkCar
  status: BluelinkStatus 
}

export interface requestProps {
  url: string
  data?: string
  method?: string
  noAuth?: boolean
  headers?: Record<string, string>
}

export interface debugLastRequest {
  url: string
  method: string
  data?: string
  headers: Record<string, string>
}

export class Bluelink {
   // @ts-ignore - creds is initalized in init
  protected creds: BluelinkCreds
  // @ts-ignore - cache is initalized in init
  protected cache: Cache
  protected vin: string | undefined
  // @ts-ignore - statusCheckInterval is initalized in init
  protected statusCheckInterval: number

  protected additionalHeaders :Record<string, string>
  protected authHeader: string
  protected tokens: BluelinkTokens | undefined
  protected debugLastRequest: debugLastRequest | undefined

  constructor(creds: BluelinkCreds, vin?: string, statusCheckInterval?: number) {
    this.additionalHeaders = {}
    this.authHeader = "Authentication"
    this.tokens = undefined
    this.debugLastRequest = undefined
  }

  protected async superInit(creds: BluelinkCreds, vin?: string, statusCheckInterval?: number) {
    this.creds = creds
    this.vin = vin
    this.statusCheckInterval = statusCheckInterval || DEFAULT_STATUS_CHECK_INTERVAL
    this.cache = await this.loadCache()
    if (! this.tokenValid()) {
      this.cache.token = await this.login()
      this.saveCache()
    }
  }

  public getCachedStatus(): Status {
    return {
      car: this.cache.car,
      status: this.cache.status
    }
  }

  // to-do need to refresh this.cache.car - which includes the odometer readind
  public async getStatus(forceUpdate: boolean) : Promise<Status> {
    if (forceUpdate) {
      this.cache.status = await this.getCarStatus(this.cache.car.id, true)
      this.saveCache()
    } else if (this.cache.status.lastStatusCheck + this.statusCheckInterval < Math.floor(Date.now()/1000)) {
      this.cache.status = await this.getCarStatus(this.cache.car.id, false)
    }
    return {
      car: this.cache.car,
      status: this.cache.status
    }
  }

  protected saveCache() {
    Keychain.set(KEYCHAIN_CACHE_KEY, JSON.stringify(this.cache))
  }

  protected async loadCache() : Promise<Cache> {
    let cache : Cache | undefined = undefined
    if (Keychain.contains(KEYCHAIN_CACHE_KEY)) {
      cache = JSON.parse(Keychain.get(KEYCHAIN_CACHE_KEY))
    } 
    if (!cache) {
      // initial use - load car and status
      this.tokens = await this.login()
      const car = await this.getCar()
      cache = {
        token: this.tokens,
        car: car,
        status: await this.getCarStatus(car.id, false)
      }
    }
    this.cache = cache
    this.saveCache()
    return this.cache
  }

  protected tokenValid(): boolean {
    // invalid if within 30 seconds of expiry
    return this.cache.token.expiry - 30 <= Math.floor(Date.now()/1000)
  }

  protected async request(props: requestProps) : Promise<any> {
    const req = new Request(props.url)
    req.method = (props.method) ? props.method : (props.data) ? "POST" : "GET"
    req.headers = {
      "Accept": "application/json",
      ...(props.data) && {
        "Content-Type": "application/json"
      },
      ...(! props.noAuth) && {
        [this.authHeader]: this.tokens ? this.tokens?.accessToken : this.cache.token.accessToken
      },
      ...this.additionalHeaders,
      ...(props.headers) && {
        ...props.headers
      }
    }    
    if (props.data) { 
      req.body = props.data
    }

    this.debugLastRequest = {
      url: props.url,
      method: req.method,
      headers: req.headers,
      ...(props.data) && {
        data: req.body
      }
    }

    return await req.loadJSON()
  }

  public getCarImage() : string {
    return ioniq5
  }

  public getCarName(): string {
    return "She-Ra"
  }

  protected async login() : Promise<BluelinkTokens> {
    // implemented in country specific sub-class
    throw Error("Not Implemented")
  }

  protected async getCarStatus(id: string, forceUpdate: boolean) : Promise<BluelinkStatus> {
    // implemented in country specific sub-class
    throw Error("Not Implemented")
  }

  protected async getCar() : Promise<BluelinkCar> {
    // implemented in country specific sub-class
    throw Error("Not Implemented")
  }
}