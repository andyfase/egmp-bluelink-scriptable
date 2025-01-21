
import { createWidget } from "widget"
import { createApp } from "app"

const KEYCHAIN_CREDS_KEY = "bluelink-creds"

export interface creds {
  username: string,
  password: string,
  region: string
}


;(async () => {

  
  let creds : creds | undefined = undefined
  if (Keychain.contains(KEYCHAIN_CREDS_KEY)) {
    creds = JSON.parse(Keychain.get(KEYCHAIN_CREDS_KEY)) as creds
  } 

  // Remove when have implemented form for user to enter in creds in main app
  creds = {
    username: "",
    password: "",
    region: "canada"
  }

  if (config.runsInWidget) {
    let widget = await createWidget(creds)
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
  }
})()

