---
title: Help
layout: home
nav_order: 6
---

# Help / FAQ
{: .fs-9 }

Below is a list of common questions and/or issues that can be encountered with resolutions
{: .fs-5 .fw-300 }

### Is this a real app, and if not why not?

No, this is not an app that sits in the Apple App Store. This is a [Scriptable](https://scriptable.app/) "app" or script. Hence you need to install the Scriptable app from the app store and then install the JavaScript build file for bluelink-scriptable. This is all documented in the [Installation page](./install.md).
{: .fs-4 .fw-400 }

For why, a combination of it being easier to develop this way, and also not being beholden to Apple App Store rules on what is allowed. This app uses un-documentated Hyundai and Kia APIs, is it quite likely a official IOS app will be either rejected or asked to be removed from the App Store - this cannot occur via Scriptable.
{: .fs-4 .fw-400 }

### Is Android Support or planned?

No, this app is IOS only and I have no ability or desire to produce a Android version. [Scriptable](https://scriptable.app/) only exists on IOS, the nearest Android equivalent is Tasker, but that lacks  the ability to actually create custom app screens and widgets from what i can tell. 

Likely for this to work on Android someone would need to develop a [React Native app](https://reactnative.dev/) which would then need to be made available to side load. Obviously this codebase is open souce and available for anyone who wishes to take on this challenge :-)

### Do a require a Kia / Hyundai Bluelink subscription to use this?

Yes, or likely so. This app uses the same Hyundai and Kia APIs that back the offical App Store apps, no checks are made within the code to check for accss to Bluelink, but it is assumed the APIs will not work if you do not have a valid subscription.

### Are my Bluelink credentials safe to enter into this app?

Yes, all configuration (including your Bluelink username, password and pin) are stored locally within the IOS keychain. The only time these credentials are exposed is if you enable Debug Logging in which case the credentials could be recorded to the logs files generated - which are only available to yourself within your own iCloud Files directory.

### Which Countries / Manufacturer's are supported?

See the [Regions](./region.md) page for supported regions.

### Are ICE cars supported?

No not yet. This app was written specifically to support Hyundai and Kia E-GMP EVs. I have been asked to support ICE vehicles, and its something I can considering adding support for. If you desire this feature, let me know by adding or commenting on an existing [Github Issue](https://github.com/andyfase/egmp-bluelink-scriptable/issues) 

### I entered my credentials incorrectly and the app wont open / does nothing

You will need to reset the stored configuration. I provide a "reset" script within all [GitHub Releases](https://github.com/andyfase/egmp-bluelink-scriptable/releases). Download the "egmp-reset.js" file under `Assets` into your Scriptable directory and run it, when prompted reset your configuration which will reset the main apps configuration.

### I think i've found a bug and would like to get it fixed.

Please raise a [Github Issue](https://github.com/andyfase/egmp-bluelink-scriptable/issues) and provide all the information around the issue you have encountered. 

You will likely need to provide debug logs. See the below question on details on how to provide these logs.

### How do I enable and obtain debug logs

There is a checkbox within the app settings to turn on debug logs. Once enabled every API request and response is then logged to a file. The in-use file is called `egmp-bluelink.log`. Log files are automatically renamed when they get to 100kb in size, hence you will see older log files named `egmp-bluelink.log.20250318150755-0700` or similar. The timestamp is the date the file was renamed.

All log files are stored within the same Scriptable directory as the scripts themselves. Note as detailed above these log files do contain your credentials. If you are asked, or provide them either directly to myself through email or via a Github issue please ensure you open the log files and redact any of your credentials (login and password)