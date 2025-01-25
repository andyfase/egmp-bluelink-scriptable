import { form } from './lib/scriptable-utils'

const KEYCHAIN_BLUELINK_CONFIG_KEY = 'egmp-bluelink-config'

export interface Auth {
  username: string
  password: string
  pin: string
  region: string
}

export interface Config {
  auth: Auth
  tempType: 'C' | 'F'
  climateTempWarm: number
  climateTempCold: number
}

export interface FlattenedConfig {
  username: string
  password: string
  pin: string
  region: string
  tempType: 'C' | 'F'
  climateTempWarm: number
  climateTempCold: number
}

const SUPPORTED_REGIONS = ['canada']

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
    ...config.auth,
    ...config,
  } as FlattenedConfig
}

export function getConfig(): Config {
  let config: Config | undefined
  if (Keychain.contains(KEYCHAIN_BLUELINK_CONFIG_KEY)) {
    config = JSON.parse(Keychain.get(KEYCHAIN_BLUELINK_CONFIG_KEY))
  }
  if (!config) {
    config = {
      auth: {
        username: '',
        password: '',
        pin: '',
        region: '',
      },
      tempType: 'C',
      climateTempCold: 19,
      climateTempWarm: 21.5,
    }
  }
  return config
}

export async function loadConfigScreen() {
  return await form<FlattenedConfig>({
    title: 'Bluelink Configuration settings',
    subtitle: 'Saved within IOS keychain and never exposed beyond your device(s)',
    onSubmit: ({ username, password, region, pin, tempType, climateTempWarm, climateTempCold }) => {
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
      } as Config)
    },
    isFormValid: ({ username, password, region, pin, tempType, climateTempCold, climateTempWarm }) => {
      if (!username || !password || !region || !pin || !climateTempCold || !tempType || !climateTempWarm) {
        return false
      }
      if (tempType === 'C' && (climateTempCold < 17 || climateTempWarm > 27)) return false
      if (tempType === 'F' && (climateTempCold < 62 || climateTempWarm > 82)) return false
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
      },
      pin: {
        type: 'numberValue',
        label: 'Bluelink PIN',
        isRequired: true,
      },
      region: {
        type: 'dropdown',
        label: 'Choose your Bluelink region',
        options: SUPPORTED_REGIONS,
        allowCustom: false,
        isRequired: true,
      },
      tempType: {
        type: 'dropdown',
        label: 'Choose your preferred temperature scale',
        options: ['C', 'F'],
        allowCustom: false,
        isRequired: true,
      },
      climateTempCold: {
        type: 'numberValue',
        label: 'Climate temp when pre-heating',
        isRequired: true,
      },
      climateTempWarm: {
        type: 'numberValue',
        label: 'Climate temp when pre-cooling',
        isRequired: true,
      },
    },
  })(getFlattenedConfig())
}
