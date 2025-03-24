import { getTable, Div, P } from 'lib/scriptable-utils'
import { GithubRelease, Version } from 'lib/version'

const { present, connect } = getTable<{
  release: GithubRelease
  currentVersion: string
}>({
  name: 'About App',
})

export async function loadAboutScreen() {
  const version = new Version('andyfase', 'egmp-bluelink-scriptable')

  return present({
    defaultState: {
      release: await version.getRelease(),
      currentVersion: version.getCurrentVersion(),
    },
    render: () => [pageTitle(), appDescription(), appWebsite()],
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
      P(
        'A scriptable app for IOS that allows you to control your Hyundai / Kia electric car using the Bluelink API. Created by Andy Fase',
        {
          font: (n) => Font.mediumRoundedSystemFont(n),
          fontSize: 20,
          align: 'left',
        },
      ),
    ],
    {
      height: 200,
    },
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
