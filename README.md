# E-GMP Bluelink Scriptable

## What is this?

An alternative Bluelink app to use on Hyundai / Kia E-GMP Electric Cars. Its a [scriptable app](https://scriptable.app/) for IOS that allows you to control your Hyundai / Kia electric car using the Bluelink API. 

## Features

* Auto-Updating Homescreen and Lockscreen Widgets
* Fresh and more responsive app UI
* Single click options for common commands (lock, warm, charge etc) in both app and in IOS Control Center
* Siri voice support "Hey Siri, Warm the car"
* Automations via IOS Shortcuts like walk-away lock
* Unlimited Custom Climate configurations 

## In-use

![e-gmp scriptable in use](./docs/images/egmp-scriptable-in-use.mp4)

## Docs

See [https://bluelink.andyfase.com](https://bluelink.andyfase.com) for all documentation on feature set, installation instructions and usgae of the app.

These docs are hosted on Github Pages from the `/docs` folder in this repo

## Dev Instructions

### Repo Structure / Codebase

The code is written in typescipt and transpiled to Javascript, which the scriptable app requires. 

`/src` is the main source code of the app  
`/docs` is a Jekyll static CMS, which Gtihub pages supports.  
`/.github/docs.yml` is the GitHub Action pipeline that builds and deploys the Github Pages  
`/exampleData` is a set of exampke API payloads 

### Building the code

```
cd src
npm i
npm run build ./src/index.ts egmp-bluelink
```

