---
title: App Features
layout: home
nav_order: 3
---

# Bluelink Scriptable feature set
{: .fs-9 }

The app is designed to perform  a subset of the main Hyundai / Kia app, but the subset that makes up for 99% of your usage. 
{: .fs-6 .fw-300 }

The app is driven through the main widget, which can sit on any homescreen of your choosing - clicking on the widget opens the app automatically, swiping away closes it. The widget automatically updates the data displayed regularly, attempting to balance freshness of data while limiting the amount of remote connections to the car.
{: .fs-5 .fw-300 }

The app also supports the use of Siri Shortcuts, allowing you to ask siri to ***"get the status of the car"***, or ***"start warming the car"***. See the Siri Shortcuts section for more info.
{: .fs-5 .fw-300 }

**Status / Remote Status**
{: .fs-5 .fw-200 }

The app queries the Bluelink API to retireve information on the SOC (State of Charge), charging status, charging completion date/time, lock/unlock, climate and finally the 12v battery charge percentage.
{: .fs-5 .fw-200 }

The widget reguarly queries the bluelink API to retrieve the lastest data on the server, however this is typically cached data as the car only updates the bluelinks servers on very in-frequent basis. 
{: .fs-5 .fw-200 }

The app also supports performing "remote refreshes" which actually queries the car and gets the most upto date information from the car. Within the app clicking the status icon will cause a remote refresh, the widget can also perform remote refreshes on a schedule - this feature needs to be opted into within the settings screen.
{: .fs-5 .fw-200 }

> IMPORTANT NOTE: Too many remote refresh commands will drain the 12v battery in the car, which in a worst case situation will cause the car to not be able to start. The widget has been configured to be very careful on the number of remote refresh commands sent, however buyer beware - hence the opt-in - I take no liabiity for any 12v failures based on the abuse of this feature.

**Start Charge / Stop Charge**
{: .fs-5 .fw-200 }

The app can stop or start charging the car. Click on the current charging status and choose start or stop.
{: .fs-5 .fw-200 }

**Climate Warm / Cool / Stop**
{: .fs-5 .fw-200 }

The app can stop or start the climate in the car, so you can pre-warm or pre-cool the car. Click on the current climate status and choose warm/cool/off.
{: .fs-5 .fw-200 }

**Lock / Unlock**
{: .fs-5 .fw-200 }

The app can lock of un-lock  the car. Click on the current lock status and choose lock or un-lock.
{: .fs-5 .fw-200 }



----
