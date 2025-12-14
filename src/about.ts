import { getTable, Div, P, Img, Spacer, quickOptions, OK } from 'lib/scriptable-utils'
import { GithubRelease, Version } from 'lib/version'
import { getAppLogger } from './lib/util'

const SCRIPTABLE_DIR = '/var/mobile/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents'
const logger = getAppLogger()

export function doDowngrade(appFile = `${Script.name()}.js`) {
  const fm = FileManager.iCloud()
  if (fm.fileExists(`${SCRIPTABLE_DIR}/${appFile}.backup`)) {
    fm.remove(`${SCRIPTABLE_DIR}/${appFile}`)
    fm.move(`${SCRIPTABLE_DIR}/${appFile}.backup`, `${SCRIPTABLE_DIR}/${appFile}`)
  } else {
    OK('Downgrade Dailed', { message: `Aucune version précédente de: ${appFile}` })       /*  */
  }
}

async function doUpgrade(url: string, appFile = `${Script.name()}.js`) {
  const req = new Request(url)
  const data = await req.load()
  if (req.response.statusCode === 200) {
    const fm = FileManager.iCloud()
    // try to backup current script - log errors, script could have been renamed for example
    try {
      if (fm.fileExists(`${SCRIPTABLE_DIR}/${appFile}.backup`)) {
        fm.remove(`${SCRIPTABLE_DIR}/${appFile}.backup`)
      }
      fm.move(`${SCRIPTABLE_DIR}/${appFile}`, `${SCRIPTABLE_DIR}/${appFile}.backup`)
    } catch (e) {
      logger.log(`Failed to backup current script: ${e}`)
    }
    fm.write(`${SCRIPTABLE_DIR}/${appFile}`, data)
  } else {
    OK('Erreur de téléchargement', { message: `Échec du téléchargement de la version: ${req.response.statusCode}` })         /*  */
  }
}

const { present, connect, setState } = getTable<{
  release: GithubRelease | undefined
  currentVersion: string
  coffeeImage: Image | undefined
}>({
  name: "À propos de l'APP" ,      /*  */
})

export async function loadAboutScreen() {
  // load version async
  const version = new Version('bleeband', 'egmp-bluelink-scriptable')
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
    P('e-GMP Bluelink app', {                       /*  */
      font: (n) => Font.boldSystemFont(n),
      fontSize: 35,
      align: 'left',
    }),
  ])
})

const appDescription = connect(() => {
  return Div(
    [
      P('Une application Scriptable pour iOS qui vous permet de contrôler votre voiture électrique Hyundai/Kia via l’API Bluelink.', {     /*  */
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
    P('Auteur: Andy Fase', {                              /*  */
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
      P(`Version:`, {                                     /*  */
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
    P(`Dernère version disponible:`, {                /*  */
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
      P(`Cliquer ici pour lancer l'installation de ${release.version}`, {           /*  */
        font: (n) => Font.mediumRoundedSystemFont(n),
        fontSize: 20,
        color: Color.blue(),
        align: 'center',
      }),
    ],
    {
      onTap: async () => {
        const appFile = `${Script.name()}.js`
        quickOptions(['Install', 'Cancel'], {
          title: `Confirmer la mise a jour de "${appFile}" et se fermera automatiquement`,         /*  */
          onOptionSelect: async (opt) => {
            if (opt === 'Install') {
              await doUpgrade(release.url, appFile)
              Script.complete()
              // @ts-ignore - undocumented api
              App.close()
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
      P(`Détails de la version:\n\n ${release.name}:\n\n ${release.notes}`, {       /*  */
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
