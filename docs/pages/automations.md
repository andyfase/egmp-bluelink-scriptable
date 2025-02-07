---
title: Automations
layout: home
nav_order: 5
---

# Automations
{: .fs-9 }

Using IOS Shortcuts it is possible to configure a number if automations. A automation is a combination of a defined shortcut and then an automation that will trigger that shortcut [based on a IOS supported event](https://support.apple.com/en-ca/guide/shortcuts/apd932ff833f/ios). Both the shortcut itself and the automation are created within the Shortcuts app.
{: .fs-5 .fw-300 }

Any shortcut automation will need to invoke the app with a given command - as a text string. The list of commands are described on the [Siri](./siri.md) page.
{: .fs-5 .fw-300 }

## Example Automations

Below are a few example automations, and downloadable Shortcut scripts. The provided shortcuts are examples, and should be modified by you to be appropiate for what you want to achieve.
{: .fs-5 .fw-300 }

### Walk Away Lock

This automation will send a lock command to the car, after a delay. The triggering event can either be disconnecting from CarPlay or disconnecting from the Car's Bluetooth.

[Install "Auto Lock Car" Shortcut](https://www.icloud.com/shortcuts/2b49acde29904725b31c64f8195074ce)
{: .fs-5 .fw-300 }

To setup the automation, perform the following:

- Click on the Automations tab
- Click on the plus
- Choose either "Bluetooth" or "Carplay"
- Select "Is Disconnected" as the trigger (not connected), select the device (i.e. the cars bluetooth or Carplay name). Finally select "Run Immediately"

### Work Day, Auto Warm the Car If its cold

This automation will send a warm command to the car, on a defined schedule (7am, on a weekday), if the outside temperature is below a given value. 

[Install "Auto Warm Car" Shortcut](https://www.icloud.com/shortcuts/804d551c2816436698ba97838ea66c26)
{: .fs-5 .fw-300 }

To setup the automation, perform the following:

- Click on the Automations tab
- Click on the plus
- Choose "Time of Day"
- Select the time you wish this automation to run, choose "Weekly" and select the days of the week you want it to run. Finally select "Run Immediately"


