import { form, confirm, quickOptions, destructiveConfirm } from './lib/scriptable-utils'

const KEYCHAIN_BLUELINK_CONFIG_KEY = 'egmp-bluelink-config'

export const STANDARD_CLIMATE_OPTIONS = ['Warm', 'Cool', 'Off', 'Cancel']

export interface Auth {
  username: string
  password: string
  pin: string
  region: string
}

export interface CustomClimateConfig {
  name: string
  tempType: 'C' | 'F'
  temp: number
  frontDefrost: boolean
  rearDefrost: boolean
  steering: boolean
  durationMinutes: number
}

export interface ChargeLimitConfig {
  name: string
  acPercent: number
  dcPercent: number
}

export interface Config {
  manufacturer: string
  auth: Auth
  tempType: 'C' | 'F'
  distanceUnit: 'km' | 'mi'
  climateTempWarm: number
  climateTempCold: number
  allowWidgetRemoteRefresh: boolean
  carColor: string
  debugLogging: boolean
  promptForUpdate: boolean
  vin: string | undefined
  widgetConfig: WidgetConfig
  customClimates: CustomClimateConfig[]
  chargeLimits: ChargeLimitConfig[]
}

export interface WidgetConfig {
  standardPollPeriod: number
  remotePollPeriod: number
  chargingRemotePollPeriod: number
  nightStandardPollPeriod: number
  nightRemotePollPeriod: number
  nightChargingRemotePollPeriod: number
}

export interface FlattenedConfig {
  manufacturer: string
  username: string
  password: string
  pin: string
  region: string
  tempType: 'C' | 'F'
  distanceUnit: 'km' | 'mi'
  climateTempWarm: number
  climateTempCold: number
  allowWidgetRemoteRefresh: boolean
  carColor: string
  debugLogging: boolean
  promptForUpdate: boolean
  vin: string | undefined
  widgetConfig: WidgetConfig
  customClimates: CustomClimateConfig[]
  chargeLimits: ChargeLimitConfig[]
}

// const SUPPORTED_REGIONS = ['canada']
const SUPPORTED_REGIONS = ['canada', 'usa', 'europe']
const SUPPORTED_MANUFACTURERS = ['Hyundai', 'Kia']
const CAR_COLORS = ['White', 'Black', 'Grey', 'Matte-Grey', 'Metallic-Grey', 'Silver', 'Red', 'Orange', 'Blue', 'Green']
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
  vin: undefined,
  auth: {
    username: '',
    password: '',
    pin: '',
    region: '',
  },
  tempType: 'C',
  distanceUnit: 'km',
  climateTempCold: DEFAULT_TEMPS.C.cold,
  climateTempWarm: DEFAULT_TEMPS.C.warm,
  debugLogging: false,
  promptForUpdate: true,
  allowWidgetRemoteRefresh: false,
  carColor: 'white',
  manufacturer: 'hyundai',
  customClimates: [],
  chargeLimits: [
    {
      name: 'Home',
      acPercent: 80,
      dcPercent: 80,
    },
    {
      name: 'Road Trip',
      acPercent: 100,
      dcPercent: 90,
    },
  ],
  widgetConfig: {
    standardPollPeriod: 1,
    remotePollPeriod: 4,
    chargingRemotePollPeriod: 2,
    nightStandardPollPeriod: 2,
    nightRemotePollPeriod: 6,
    nightChargingRemotePollPeriod: 4,
  },
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
  config.auth.pin = config.auth.pin.toString() // convert previous pin if integer
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
  return {
    ...DEFAULT_CONFIG,
    ...config,
  }
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
      distanceUnit,
      climateTempWarm,
      climateTempCold,
      debugLogging,
      promptForUpdate,
      allowWidgetRemoteRefresh,
      carColor,
      manufacturer: manufacturer,
      vin: vin,
    }) => {
      // read and combine with current saved config as other config screens may have changed settings (custom climates etc)
      const config = getConfig()
      setConfig({
        ...config,
        ...{
          auth: {
            username: username,
            password: password,
            region: region,
            pin: pin,
          },
          tempType: tempType,
          distanceUnit: distanceUnit,
          climateTempCold: climateTempCold,
          climateTempWarm: climateTempWarm,
          allowWidgetRemoteRefresh: allowWidgetRemoteRefresh,
          carColor: carColor ? carColor.toLocaleLowerCase() : 'white',
          debugLogging: debugLogging,
          promptForUpdate: promptForUpdate,
          manufacturer: manufacturer?.toLowerCase(),
          vin: vin ? vin.toUpperCase().trim() : undefined,
        },
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
        type: 'textInput',
        label: 'Bluelink PIN',
        isRequired: true,
        secure: true,
        flavor: 'number',
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
        isRequired: true,
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
      distanceUnit: {
        type: 'dropdown',
        label: 'Choose your preferred distance unit',
        options: ['km', 'mi'],
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
      carColor: {
        type: 'dropdown',
        label: 'Car Color (Will default to white if not available)',
        options: CAR_COLORS,
        allowCustom: false,
        isRequired: true,
      },
      allowWidgetRemoteRefresh: {
        type: 'checkbox',
        label: 'Enable widget remote refresh',
        isRequired: false,
      },
      debugLogging: {
        type: 'checkbox',
        label: 'Enable debug logging',
        isRequired: false,
      },
      promptForUpdate: {
        type: 'checkbox',
        label: 'Enable prompting for app updates',
        isRequired: false,
      },
      widgetConfig: {
        type: 'clickable',
        label: 'Optional Advanced Widget Settings',
        customIcon: 'gear',
        faded: true,
        onClickFunction: loadWidgetConfigScreen,
      },
      chargeLimits: {
        type: 'clickable',
        label: 'Charge Limit Profiles',
        customIcon: 'climate',
        faded: true,
        onClickFunction: () => {
          const config = getConfig()
          const chargeLimitNames = Object.values(config.chargeLimits).map((x) => x.name)
          quickOptions(['New'].concat(chargeLimitNames), {
            title: 'Create New Custom Climate or Edit Existing',
            onOptionSelect: (opt) => {
              loadChargeLimitConfig(
                opt !== 'New' ? Object.values(config.chargeLimits).filter((x) => x.name === opt)[0] : undefined,
              )
            },
          })
        },
      },
      customClimates: {
        type: 'clickable',
        label: 'Optional Custom Climates',
        customIcon: 'gear',
        faded: true,
        onClickFunction: () => {
          const config = getConfig()
          const customClimateNames = Object.values(config.customClimates).map((x) => x.name)
          quickOptions(['New'].concat(customClimateNames), {
            title: 'Create New Custom Climate or Edit Existing',
            onOptionSelect: (opt) => {
              loadCustomClimateConfig(
                opt !== 'New' ? Object.values(config.customClimates).filter((x) => x.name === opt)[0] : undefined,
              )
            },
          })
        },
      },
    },
  })(getFlattenedConfig())
}

export async function loadWidgetConfigScreen() {
  return await form<WidgetConfig>({
    title: 'Widget Poll Periods',
    subtitle: 'All periods are measured in hours',
    onSubmit: ({
      standardPollPeriod,
      remotePollPeriod,
      chargingRemotePollPeriod,
      nightStandardPollPeriod,
      nightRemotePollPeriod,
      nightChargingRemotePollPeriod,
    }) => {
      const config = getConfig()
      config.widgetConfig = {
        standardPollPeriod: standardPollPeriod || config.widgetConfig.standardPollPeriod,
        remotePollPeriod: remotePollPeriod || config.widgetConfig.remotePollPeriod,
        chargingRemotePollPeriod: chargingRemotePollPeriod || config.widgetConfig.chargingRemotePollPeriod,
        nightStandardPollPeriod: nightStandardPollPeriod || config.widgetConfig.nightStandardPollPeriod,
        nightRemotePollPeriod: nightRemotePollPeriod || config.widgetConfig.nightRemotePollPeriod,
        nightChargingRemotePollPeriod:
          nightChargingRemotePollPeriod || config.widgetConfig.nightChargingRemotePollPeriod,
      }
      setConfig(config)
    },
    onStateChange: (state, _previousState): Partial<WidgetConfig> => {
      return state
    },
    isFormValid: ({
      standardPollPeriod,
      remotePollPeriod,
      chargingRemotePollPeriod,
      nightStandardPollPeriod,
      nightRemotePollPeriod,
      nightChargingRemotePollPeriod,
    }) => {
      if (
        !standardPollPeriod ||
        !remotePollPeriod ||
        !chargingRemotePollPeriod ||
        !nightStandardPollPeriod ||
        !nightRemotePollPeriod ||
        !nightChargingRemotePollPeriod
      ) {
        return false
      }
      return true
    },
    submitButtonText: 'Save',
    fields: {
      standardPollPeriod: {
        type: 'numberValue',
        label: 'API Poll Period',
        isRequired: true,
      },
      remotePollPeriod: {
        type: 'numberValue',
        label: 'Remote Car Poll Period',
        isRequired: true,
      },
      chargingRemotePollPeriod: {
        type: 'numberValue',
        label: 'Remote Car Charging Poll Period',
        isRequired: true,
      },
      nightStandardPollPeriod: {
        type: 'numberValue',
        label: 'Night API Poll Period',
        isRequired: true,
      },
      nightRemotePollPeriod: {
        type: 'numberValue',
        label: 'Night Remote Car Poll Period',
        isRequired: true,
      },
      nightChargingRemotePollPeriod: {
        type: 'numberValue',
        label: 'Night Remote Car Charging Poll Period',
        isRequired: true,
      },
    },
  })(getFlattenedConfig().widgetConfig)
}

export async function loadCustomClimateConfig(climateConfig: CustomClimateConfig | undefined) {
  const previousName = climateConfig ? climateConfig.name : undefined
  if (!climateConfig) {
    climateConfig = {
      name: '',
      tempType: 'C',
      temp: DEFAULT_TEMPS.C.warm,
      frontDefrost: true,
      rearDefrost: true,
      steering: true,
      durationMinutes: 15,
    } as CustomClimateConfig
  }

  return await form<CustomClimateConfig & { delete: boolean }>({
    title: 'Custom Climate Configuration',
    subtitle: previousName ? `Editing configuration: ${previousName}` : 'Create new configuration',
    onSubmit: ({ name, tempType, temp, frontDefrost, rearDefrost, steering, durationMinutes }) => {
      const config = getConfig()
      const newConfig = {
        name: name,
        tempType: tempType,
        temp: temp,
        frontDefrost: frontDefrost,
        rearDefrost: rearDefrost,
        steering: steering,
        durationMinutes: durationMinutes,
      } as CustomClimateConfig
      if (previousName) {
        const index = config.customClimates.findIndex((x) => x.name === previousName)
        config.customClimates[index] = newConfig
      } else {
        config.customClimates.push(newConfig)
      }
      setConfig(config)
    },
    onStateChange: (state, previousState): Partial<CustomClimateConfig> => {
      if (state.tempType !== previousState.tempType) {
        if (state.tempType === 'C') {
          state.temp = DEFAULT_TEMPS.C.warm
        } else {
          state.temp = DEFAULT_TEMPS.F.warm
        }
      }
      return state
    },
    isFormValid: ({ name, tempType, temp, durationMinutes }) => {
      if (!name || !tempType || !temp || !durationMinutes) return false
      if (tempType === 'C' && (temp < 17 || temp > 27)) return false
      if (tempType === 'F' && (temp < 62 || temp > 82)) return false
      if (temp.toString().includes('.') && temp % 1 !== 0.5) return false
      if (temp.toString().includes('.') && temp % 1 !== 0.5) return false

      // check for name collision on our default options
      if (STANDARD_CLIMATE_OPTIONS.includes(name)) return false

      // check for name collision on other custom options
      const config = getConfig()
      const customClimateNames = Object.values(config.customClimates).map((x) => x.name)
      if (previousName) customClimateNames.splice(customClimateNames.indexOf(previousName), 1)
      if (customClimateNames.includes(name)) return false
      return true
    },
    submitButtonText: 'Save',
    fields: {
      name: {
        type: 'textInput',
        label: 'Name',
        isRequired: true,
      },
      tempType: {
        type: 'dropdown',
        label: 'Choose your preferred temperature scale',
        options: ['C', 'F'],
        allowCustom: false,
        isRequired: true,
      },
      temp: {
        type: 'numberValue',
        label: 'Desired climate temp (whole number or .5)',
        isRequired: true,
      },
      frontDefrost: {
        type: 'checkbox',
        label: 'Enable front defrost?',
        isRequired: false,
      },
      rearDefrost: {
        type: 'checkbox',
        label: 'Enable rear/side defrost?',
        isRequired: false,
      },
      steering: {
        type: 'checkbox',
        label: 'Enable heated steering?',
        isRequired: false,
      },
      durationMinutes: {
        type: 'numberValue',
        label: 'Number of Minutes to run climate',
        isRequired: true,
      },
      delete: {
        type: 'clickable',
        label: 'Delete Climate Configuration',
        customIcon: 'delete',
        faded: true,
        dismissOnTap: true,
        onClickFunction: () => {
          if (!previousName) return
          destructiveConfirm(`Delete Climate Configuration ${previousName}?`, {
            onConfirm: () => {
              const config = getConfig()
              const customClimateNames = Object.values(config.customClimates).map((x) => x.name)
              const index = customClimateNames.indexOf(previousName)
              config.customClimates.splice(index, 1)
              setConfig(config)
            },
          })
        },
      },
    },
  })(climateConfig)
}

export async function loadChargeLimitConfig(chargeLimit: ChargeLimitConfig | undefined) {
  const previousName = chargeLimit ? chargeLimit.name : undefined
  if (!chargeLimit) {
    chargeLimit = {
      name: '',
      acPercent: 80,
      dcPercent: 80,
    } as ChargeLimitConfig
  }

  return await form<ChargeLimitConfig & { delete: boolean }>({
    title: 'Charge Limit Configuration',
    subtitle: previousName ? `Editing configuration: ${previousName}` : 'Create new configuration',
    onSubmit: ({ name, acPercent, dcPercent }) => {
      const config = getConfig()
      const newConfig = {
        name: name,
        acPercent: acPercent,
        dcPercent: dcPercent,
      } as ChargeLimitConfig
      if (previousName) {
        const index = config.chargeLimits.findIndex((x) => x.name === previousName)
        config.chargeLimits[index] = newConfig
      } else {
        config.chargeLimits.push(newConfig)
      }
      setConfig(config)
    },
    isFormValid: ({ name, acPercent, dcPercent }) => {
      if (!name || !acPercent || !dcPercent) return false
      if (acPercent < 0 || acPercent > 100) return false
      if (dcPercent < 0 || dcPercent > 100) return false
      if (!(acPercent % 10 === 0)) return false
      if (!(dcPercent % 10 === 0)) return false

      // check for name collision on other custom options
      const config = getConfig()
      const chargeLimitNames = Object.values(config.chargeLimits).map((x) => x.name)
      if (previousName) chargeLimitNames.splice(chargeLimitNames.indexOf(previousName), 1)
      if (chargeLimitNames.includes(name)) return false
      return true
    },
    submitButtonText: 'Save',
    fields: {
      name: {
        type: 'textInput',
        label: 'Name',
        isRequired: true,
      },
      acPercent: {
        type: 'numberValue',
        label: 'Desired AC (Slow) charge limit (0-100 in 10% increments)',
        isRequired: true,
      },
      dcPercent: {
        type: 'numberValue',
        label: 'Desired DC (Fast) charge limit (0-100 in 10% increments)',
        isRequired: true,
      },
      delete: {
        type: 'clickable',
        label: 'Delete Charge Limit Configuration',
        customIcon: 'delete',
        faded: true,
        dismissOnTap: true,
        onClickFunction: () => {
          if (!previousName) return
          destructiveConfirm(`Delete Charge Limit ${previousName}?`, {
            onConfirm: () => {
              const config = getConfig()
              const chargeLimitNames = Object.values(config.chargeLimits).map((x) => x.name)
              const index = chargeLimitNames.indexOf(previousName)
              config.chargeLimits.splice(index, 1)
              setConfig(config)
            },
          })
        },
      },
    },
  })(chargeLimit)
}
