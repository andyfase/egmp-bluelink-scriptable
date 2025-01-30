import { form, confirm } from './lib/scriptable-utils'

const KEYCHAIN_BLUELINK_CONFIG_KEY = 'egmp-bluelink-config'

export interface Auth {
  username: string
  password: string
  pin: string
  region: string
}

export interface Config {
  manufacturer: string | undefined
  auth: Auth
  tempType: 'C' | 'F'
  climateTempWarm: number
  climateTempCold: number
  allowWidgetRemoteRefresh: boolean
  debugLogging: boolean
  vin: string | undefined
}

export interface FlattenedConfig {
  manufacturer: string | undefined
  username: string
  password: string
  pin: string
  region: string
  tempType: 'C' | 'F'
  climateTempWarm: number
  climateTempCold: number
  allowWidgetRemoteRefresh: boolean
  debugLogging: boolean
  vin: string | undefined
}

const SUPPORTED_REGIONS = ['canada']
const SUPPORTED_MANUFACTURERS = ['Hyundai', 'Kia']

const DEFAULT_TEMPS = {
  C: {
    cold: 19,
    warm: 21.5,
  },
  F: {
    cold: 66,
    warm: 71,
  },
}

const DEFAULT_CONFIG = {
  auth: {
    username: '',
    password: '',
    pin: '',
    region: '',
  },
  tempType: 'C',
  climateTempCold: DEFAULT_TEMPS.C.cold,
  climateTempWarm: DEFAULT_TEMPS.C.warm,
  debugLogging: false,
  allowWidgetRemoteRefresh: false,
  manufacturer: undefined,
} as Config

export function configExists(): boolean {
  return Keychain.contains(KEYCHAIN_BLUELINK_CONFIG_KEY)
}

export function deleteConfig() {
  Keychain.remove(KEYCHAIN_BLUELINK_CONFIG_KEY)
}

export function setConfig(config: Config) {
  Keychain.set(KEYCHAIN_BLUELINK_CONFIG_KEY, JSON.stringify(config))
}

export function getFlattenedConfig(): FlattenedConfig {
  const config = getConfig()
  return {
    ...DEFAULT_CONFIG,
    ...config.auth,
    ...config,
  } as FlattenedConfig
}

export function getConfig(): Config {
  let config: Config | undefined
  if (Keychain.contains(KEYCHAIN_BLUELINK_CONFIG_KEY)) {
    config = JSON.parse(Keychain.get(KEYCHAIN_BLUELINK_CONFIG_KEY))
  }
  if (!config || !configValid) {
    config = DEFAULT_CONFIG
  }
  return config
}

function configValid(config: Config): boolean {
  return config && Object.hasOwn(config, 'auth')
}

export async function loadConfigScreen() {
  return await form<FlattenedConfig>({
    title: 'Bluelink Configuration settings',
    subtitle: 'Saved within IOS keychain and never exposed beyond your device(s)',
    onSubmit: ({
      username,
      password,
      region,
      pin,
      tempType,
      climateTempWarm,
      climateTempCold,
      debugLogging,
      allowWidgetRemoteRefresh,
      manufacturer: manufacturer,
      vin: vin,
    }) => {
      setConfig({
        auth: {
          username: username,
          password: password,
          region: region,
          pin: pin,
        },
        tempType: tempType,
        climateTempCold: climateTempCold,
        climateTempWarm: climateTempWarm,
        allowWidgetRemoteRefresh: allowWidgetRemoteRefresh,
        debugLogging: debugLogging,
        manufacturer: manufacturer?.toLowerCase(),
        vin: vin ? vin.toUpperCase() : undefined,
      } as Config)
    },
    onStateChange: (state, previousState): Partial<FlattenedConfig> => {
      if (state.tempType !== previousState.tempType) {
        if (state.tempType === 'C') {
          state.climateTempCold = DEFAULT_TEMPS.C.cold
          state.climateTempWarm = DEFAULT_TEMPS.C.warm
        } else {
          state.climateTempCold = DEFAULT_TEMPS.F.cold
          state.climateTempWarm = DEFAULT_TEMPS.F.warm
        }
      }
      if (state.allowWidgetRemoteRefresh && !previousState.allowWidgetRemoteRefresh) {
        confirm('Enabling background remote refresh may impact your 12v battery ', {
          confirmButtonTitle: 'I understand',
          includeCancel: false,
        })
      }
      return state
    },
    isFormValid: ({ username, password, region, pin, tempType, climateTempCold, climateTempWarm }) => {
      if (!username || !password || !region || !pin || !climateTempCold || !tempType || !climateTempWarm) {
        return false
      }
      if (tempType === 'C' && (climateTempCold < 17 || climateTempWarm > 27)) return false
      if (tempType === 'F' && (climateTempCold < 62 || climateTempWarm > 82)) return false
      if (climateTempCold.toString().includes('.') && climateTempCold % 1 !== 0.5) return false
      if (climateTempWarm.toString().includes('.') && climateTempWarm % 1 !== 0.5) return false
      return true
    },
    submitButtonText: 'Save',
    fields: {
      username: {
        type: 'textInput',
        label: 'Bluelink Username',
        isRequired: true,
      },
      password: {
        type: 'textInput',
        label: 'Bluelink Password',
        isRequired: true,
        secure: true,
      },
      pin: {
        type: 'numberValue',
        label: 'Bluelink PIN',
        isRequired: true,
        secure: true,
      },
      region: {
        type: 'dropdown',
        label: 'Choose your Bluelink region',
        options: SUPPORTED_REGIONS,
        allowCustom: false,
        isRequired: true,
      },
      manufacturer: {
        type: 'dropdown',
        label: 'Choose your Car Manufacturer',
        options: SUPPORTED_MANUFACTURERS,
        allowCustom: false,
        isRequired: false,
      },
      vin: {
        type: 'textInput',
        label: 'Optional VIN of car',
        isRequired: false,
      },
      tempType: {
        type: 'dropdown',
        label: 'Choose your preferred temperature scale',
        options: ['C', 'F'],
        allowCustom: false,
        isRequired: true,
      },
      climateTempWarm: {
        type: 'numberValue',
        label: 'Climate temp when pre-heating (whole number or .5)',
        isRequired: true,
      },
      climateTempCold: {
        type: 'numberValue',
        label: 'Climate temp when pre-cooling (whole number or .5)',
        isRequired: true,
      },
      allowWidgetRemoteRefresh: {
        type: 'checkbox',
        label: 'Enable background remote refresh',
        isRequired: false,
      },
      debugLogging: {
        type: 'checkbox',
        label: 'Enable debug logging',
        isRequired: false,
      },
    },
  })(getFlattenedConfig())
}
