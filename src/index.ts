import { createWidget } from 'widget'
import { createApp } from 'app'
import { BluelinkCreds } from 'lib/bluelink-regions/base'

const KEYCHAIN_CREDS_KEY = 'bluelink-creds'

;(async () => {
  let creds: BluelinkCreds | undefined = undefined
  if (Keychain.contains(KEYCHAIN_CREDS_KEY)) {
    creds = JSON.parse(Keychain.get(KEYCHAIN_CREDS_KEY)) as BluelinkCreds
  }

  // Remove when have implemented form for user to enter in creds in main app
  creds = {
    username: '',
    password: '',
    region: 'canada',
    pin: '',
  }

  if (config.runsInWidget) {
    const widget = await createWidget(creds)
    Script.setWidget(widget)
    Script.complete()
  } else {
    try {
      const resp = await createApp(creds)
      // @ts-ignore - undocumented api
      App.close() // add this back after dev
      return resp
    } catch (error) {
      logError(error)
    }
  }
})()
