import { form } from 'scriptable-utils'

const KEYCHAIN_BLUELINK_CONFIG_KEY = 'bluelink-config'

export interface Config {
  username: string
  password: string
  pin: string
  region: string
}

const SUPPORTED_REGIONS = ['canada']

export function configExists(): boolean {
  return Keychain.contains(KEYCHAIN_BLUELINK_CONFIG_KEY)
}

export function setConfig(config: Config) {
  Keychain.set(KEYCHAIN_BLUELINK_CONFIG_KEY, JSON.stringify(config))
}

export function getConfig(): Config {
  let config: Config | undefined
  if (Keychain.contains(KEYCHAIN_BLUELINK_CONFIG_KEY)) {
    config = JSON.parse(Keychain.get(KEYCHAIN_BLUELINK_CONFIG_KEY))
  }
  if (!config) {
    config = {
      username: '',
      password: '',
      pin: '',
      region: '',
    }
  }
  return config
}

export async function loadConfigScreen() {
  return await form<Config>({
    title: 'Bluelink Configuration settings',
    subtitle: 'Settings are securely saved within IOS keychain and never exposed beyond your device',
    onSubmit: ({ username, password, region, pin }) => {
      setConfig({
        username: username,
        password: password,
        region: region,
        pin: pin,
      } as Config)
    },
    isFormValid: ({ username, password, region, pin }) => {
      return Boolean(username && password && region && pin)
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
    },
  })(getConfig())
}
