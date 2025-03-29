import { getTable, Div, P, Img, Spacer, quickOptions, OK } from 'lib/scriptable-utils'
import { GithubRelease, Version } from 'lib/version'
import { Logger } from './lib/logger'
import { APP_LOG_FILE } from './lib/util'

const SCRIPTABLE_DIR = '/var/mobile/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents'
const logger = new Logger(APP_LOG_FILE, 100)

const { present, connect, setState } = getTable<{
  release: GithubRelease | undefined
  currentVersion: string
  coffeeImage: Image | undefined
}>({
  name: 'About App',
})

export async function loadAboutScreen() {
  // load version async
  const version = new Version('andyfase', 'egmp-bluelink-scriptable')
  version.getRelease().then((release) => setState({ release: release }))

  // load image async
  const req = new Request('https://bluelink.andyfase.com/images/coffee.png')
  req.loadImage().then((image) => setState({ coffeeImage: image }))

  return present({
    defaultState: {
      release: undefined,
      currentVersion: version.getCurrentVersion(),
      coffeeImage: undefined,
    },
    render: () => [
      pageTitle(),
      appDescription(),
      appWebsite(),
      author(),
      Spacer({ rowHeight: 30 }),
      currentVersion(),
      latestVersion(),
      Spacer(),
      upgrade(),
      upgradeNotes(),
    ],
  })
}

const pageTitle = connect(() => {
  return Div([
    P('e-GMP Bluelink app', {
      font: (n) => Font.boldSystemFont(n),
      fontSize: 35,
      align: 'left',
    }),
  ])
})

const appDescription = connect(() => {
  return Div(
    [
      P('A scriptable app for IOS that allows you to control your Hyundai / Kia electric car using the Bluelink API.', {
        font: (n) => Font.mediumRoundedSystemFont(n),
        fontSize: 20,
        align: 'left',
      }),
    ],
    {
      height: 100,
    },
  )
})

const author = connect(({ state: { coffeeImage } }) => {
  const divArray = [
    P('Author: Andy Fase', {
      font: (n) => Font.mediumRoundedSystemFont(n),
      fontSize: 20,
      align: 'left',
    }),
  ]
  if (coffeeImage) {
    divArray.push(Img(coffeeImage, { align: 'right', width: '50%' }))
  }
  return Div(divArray, { height: 60, align: 'center', onTap: () => Safari.open('https://buymeacoffee.com/andyfase') })
})

const currentVersion = connect(({ state: { currentVersion } }) => {
  return Div([
    P(`Current Version:`, {
      font: (n) => Font.mediumRoundedSystemFont(n),
      fontSize: 20,
      align: 'left',
    }),
    P(currentVersion, {
      font: (n) => Font.boldRoundedSystemFont(n),
      fontSize: 20,
      align: 'right',
    }),
  ])
})

const latestVersion = connect(({ state: { currentVersion, release } }) => {
  if (!release) return Spacer()

  return Div([
    P(`Latest Version Available:`, {
      font: (n) => Font.mediumRoundedSystemFont(n),
      fontSize: 20,
      align: 'left',
      width: '80%',
    }),
    P(release.version, {
      font: (n) => Font.boldRoundedSystemFont(n),
      fontSize: 20,
      align: 'right',
      color:
        Version.versionToNumber(currentVersion) >= Version.versionToNumber(release.version)
          ? Color.green()
          : Color.blue(),
    }),
  ])
})

const upgrade = connect(({ state: { currentVersion, release } }) => {
  if (!release || Version.versionToNumber(currentVersion) >= Version.versionToNumber(release.version)) return Spacer()

  return Div(
    [
      P(`Click to Auto Install ${release.version}`, {
        font: (n) => Font.mediumRoundedSystemFont(n),
        fontSize: 20,
        color: Color.blue(),
        align: 'center',
      }),
    ],
    {
      onTap: async () => {
        quickOptions(['Install', 'Cancel'], {
          title: 'Confirm Install - App will update and auto-close',
          onOptionSelect: async (opt) => {
            if (opt === 'Install') {
              const req = new Request(release.url)
              const data = await req.load()
              if (req.response.statusCode === 200) {
                const fm = FileManager.iCloud()
                // try to backup current script - log errors, script could have been renamed for example
                try {
                  if (fm.fileExists(`${SCRIPTABLE_DIR}/${release.assetName}.backup`)) {
                    fm.remove(`${SCRIPTABLE_DIR}/${release.assetName}.backup`)
                  }
                  fm.move(`${SCRIPTABLE_DIR}/${release.assetName}`, `${SCRIPTABLE_DIR}/${release.assetName}.backup`)
                } catch (e) {
                  logger.log(`Failed to backup current script: ${e}`)
                }
                fm.write(`${SCRIPTABLE_DIR}/${release.assetName}`, data)
                Script.complete()
                // @ts-ignore - undocumented api
                App.close()
              } else {
                OK('Download Error', { message: `Failed to download release: ${req.response.statusCode}` })
              }
            }
          },
        })
      },
    },
  )
})

const upgradeNotes = connect(({ state: { currentVersion, release } }) => {
  if (!release || Version.versionToNumber(currentVersion) >= Version.versionToNumber(release.version)) return Spacer()

  return Div(
    [
      P(`Release Details:\n\n ${release.name}:\n\n ${release.notes}`, {
        font: (n) => Font.mediumRoundedSystemFont(n),
        fontSize: 17,
        align: 'left',
      }),
    ],
    { height: 300 },
  )
})

const appWebsite = connect(() => {
  return Div(
    [
      P('https://bluelink.andyfase.com', {
        font: (n) => Font.mediumRoundedSystemFont(n),
        fontSize: 20,
        color: Color.blue(),
        align: 'left',
      }),
    ],
    {
      onTap: async () => {
        Safari.open('https://bluelink.andyfase.com')
      },
    },
  )
})
