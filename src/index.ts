
import { createWidget } from "widget"

;(async () => {

  if (config.runsInWidget) {
    let widget = await createWidget()
    Script.setWidget(widget)
    Script.complete()
  } else {
    Safari.open("https://www.google.com")
  }
})()

