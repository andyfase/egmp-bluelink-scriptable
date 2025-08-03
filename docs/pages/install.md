---
title: Installation
layout: home
nav_order: 4
---

# Install Guide
{: .fs-9 }

Bluelink Scriptable is a "scriptable app". Its written in Javascript and runs within the [scriptable IOS app](https://scriptable.app/). Using scriptable meant a vastly reduced amount of development time was required, and no pesky app store rejections
{: .fs-5 .fw-300 }

As such, installation is a couple more test than just "install an app". However once installed the app will prompt and auto-install new versions as they are released!.
{: .fs-5 .fw-300 } 

## Install Steps

Step 1: [Install the scriptable app](https://apps.apple.com/us/app/scriptable/id1405459188?uo=4)
and open it.
{: .fs-4 .fw-300 } 

Step 2: [Download the latest egmp-bluelink.js file](https://github.com/andyfase/egmp-bluelink-scriptable/releases) using your iPhone.
{: .fs-4 .fw-300 }

![image](../images/download.png)

Step 3: Using the IOS **Apple Files** app, move the `egmp-bluelink.js` file from the Downloads directory into the "iCloud Drive" -> "Scriptable" directory.
{: .fs-4 .fw-300 }

Step 4: Open the scriptable app and choose "egmp-bluelink". This launches the app for the first time and a settings screen will popup asking you to fill in your Bluelink login credentials, and set your preferences. 
{: .fs-4 .fw-300 }

> Note: Your Bluelink credentials are securely kept on your IOS keychain, the bluelink scriptable app never sends your credentials to anywhere except the Bluelink API, just like the offical app.

Step 5: Once you enter your credentials and press "Save" the app will close. Click on "egmp-bluelink" again and the app will open and be available for use.
{: .fs-5 .fw-300 }

Step 6: Create a new widget on your homescreen or lockscreen . [See the apple guide if you need help](https://support.apple.com/en-ca/118610). The [Widget Page](./widgets.md) shows the available widgets to choose from 
{: .fs-5 .fw-300 }

When configuring the widget, make sure you:
{: .fs-5 .fw-300 }

- Choose **"Scriptable"** from the list of widgets
- Choose the medium size (the only one supported)
- Click on the widget on your homescreen to configure it. 
- For **"Script"** choose **egmp-bluelink**
- For **"When Interacting"** choose **Run Script**

Step 7: (Optional but Recommended) Continue to install the [Siri IOS Shortcuts](./siri.md) and the [Control Center controls](./control-center.md)
{: .fs-5 .fw-300 }

Thats it you're done. Enjoy bluelink-scriptable!
{: .fs-5 .fw-300 }

----
