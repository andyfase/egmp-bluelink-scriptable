---
title: Siri / Shortcuts
layout: home
nav_order: 5
---

# Siri Shortcuts Support
{: .fs-9 }

The app supports direct Siri interaction via the "Shortcuts" IOS app. A collection of Shortcut download link are provided below. These can be used both while talking to Siri, or through interaction through the [IOS control center](./control-center.md).
{: .fs-5 .fw-300 }

## Common Commmands Shortcuts

These shortcuts can be used via Siri or through [Control Center](./control-center.md).

### Lock the Car - "Hey Siri, Lock the car"
[Install "Lock Car" Shortcut](https://www.icloud.com/shortcuts/5b569f78ef00452b9d7fe4455635d36d)
{: .fs-5 .fw-300 }

### UnLock the Car - "Hey Siri, Unlock the car"
[Install "Unlock the Car" Shortcut](https://www.icloud.com/shortcuts/631cb0865dfc4358837485410eb2a46f)
{: .fs-5 .fw-300 }

### Warm the Car - "Hey Siri, warm the car"
[Install "Warm the Car" Shortcut](https://www.icloud.com/shortcuts/ea24582e07e44edea66b0d7a9773ea75)
{: .fs-5 .fw-300 }

### Cool the Car - "Hey Siri, Cool the car"
[Install "Cool the Car" Shortcut](https://www.icloud.com/shortcuts/486487c8d3c841feb9d4b46476eef294)
{: .fs-5 .fw-300 }



## Ask the Car Shortcut
[Install "Ask the Car" Shortcut](https://www.icloud.com/shortcuts/b3bd704fa2bf4c6dabceec096c291342)
{: .fs-5 .fw-300 }

Once installed, interact with the shortcut by saying **"Hey Siri, Ask the car"**. Siri will respond by asking **"Whats the Command?"** and you can reply with a natural text string, which will be passed to the app. The app identifies the commands by matching specific keywords, listed below.
{: .fs-5 .fw-300 }

A interaction starts by you asking Siri to run the shortcut name, in this case its named "Start the Car", hence an interaction is like: 
{: .fs-5 .fw-300 }

**You: "Hey Siri, Ask the car"**  *(This runs the shortcut)*  
**Siri: "Whats the Command?"**  *(The shortcut prompts for some input)*    
**You: "What's the status of the car?"**  *(Your input will be sent to the app)*   
**Siri: "Your Ioniq 5's battery is at 75% and locked. Your car is also charging at 6kw and will be finished at 9pm"** *(This is the response from the app that Siri will read to you)*
{: .fs-5 .fw-400 }

You can change the name of the shortcut, or the command prompt - just remember if you change the name - thats what you have to say to start the interation.
{: .fs-5 .fw-300 }

## Supported Keywords

The following keywords are supported:
{: .fs-5 .fw-400 }

### Status

This will return the latest status of the car from the Bluelink API. Typically this will be a sentence stating charge status, if the car is locked and if the car is charging (and if it is when it will finish charging).
{: .fs-5 .fw-400 }

Example: "What's the **status** of the car?"
{: .fs-5 .fw-400 }

### Remote Status

This will issue a remote status command to the car to get the latest updated information. Once issued a normal status command will need to be issued approx 30 seconds later to retrieve this information
{: .fs-5 .fw-400 }

Example: "What's the **remote status** of the car?"
{: .fs-5 .fw-400 }

### Lock

This will issue a remote lock command to the car
{: .fs-5 .fw-400 }

Example: "Please **lock** the car?"
{: .fs-5 .fw-400 }

### Unlock

This will issue a remote un-lock command to the car
{: .fs-5 .fw-400 }

Example: "Please **unlock** the car?"
{: .fs-5 .fw-400 }

### Cool

This will issue a remote command to pre-cool the car.
{: .fs-5 .fw-400 }

Example: "Can you start **cooling** the car?"
{: .fs-5 .fw-400 }

### Warm

This will issue a remote command to pre-heat the car.
{: .fs-5 .fw-400 }

Example: "Can you start **warming** the car?"
{: .fs-5 .fw-400 }

### Climate off

This will issue a remote command to stop the climate controls in the car.
{: .fs-5 .fw-400 }

Example: "Turn the **climate off** please"
{: .fs-5 .fw-400 }

### Custom Climate Start

this will issue a remote command to start the climate controls based on your confiured custom climate configuration (created within the settings screens). This option is triggered based on the word "climate" plus the name of the custom climate configuration. 

As an example, given a custom climate configuration named "Super Hot" you would say:

Example "Turn on **climate super hot** please"

### Start charging

This will issue a remote command to start charging the car.
{: .fs-5 .fw-400 }

Example: "**Start charging** the car"
{: .fs-5 .fw-400 }

### Stop charging

This will issue a remote command to stop charging the car.
{: .fs-5 .fw-400 }

Example: "**Stop charging** the car"
{: .fs-5 .fw-400 }

### Set Charge Limits
This will issue a remote command to set the named charge limit of the car (i.e. percentage of battery to stop charging at).
{: .fs-5 .fw-400 }

Example: "Set **Charge Limit RoadTrip**"
{: .fs-5 .fw-400 }