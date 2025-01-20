
import { createWidget } from "widget"
import { createApp } from "app"

;(async () => {
  if (config.runsInWidget) {
    let widget = await createWidget()
    Script.setWidget(widget)
    Script.complete()
  } else {
    const resp = await createApp()
    // @ts-ignore - undocumented api
    // App.close() // add this back after dev
    return resp
    // Safari.open("https://www.google.com")
  }
})()

