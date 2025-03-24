import version from '../version.json'

export interface GithubRelease {
  version: string
  name: string
  date: string
  url: string
}

export class Version {
  private currentVersion: string
  private githubLatestRelease: GithubRelease | undefined

  private githubUser: string
  private githubRepoName: string

  constructor(githubUser: string, githubRepoName: string) {
    this.githubRepoName = githubRepoName
    this.githubUser = githubUser
    this.currentVersion = version.version
    this.githubLatestRelease = undefined
  }

  public async promptForUpdate(): Promise<boolean> {
    const latestRelease = await this.getLatestGithubRelease()
    // releases are in the format v0.7.0 we prompt for update is a minor version behind i.e. 0.1
    return Number(latestRelease.version.replace('v', '')) - Number(this.currentVersion.replace('v', '')) >= 0.1
  }

  public async getReleaseVersion(): Promise<string> {
    const latestRelease = await this.getLatestGithubRelease()
    return latestRelease.version
  }

  public getCurrentVersion(): string {
    return this.currentVersion
  }

  public async getRelease(): Promise<GithubRelease> {
    return await this.getLatestGithubRelease()
  }

  private async getLatestGithubRelease(): Promise<GithubRelease> {
    if (this.githubLatestRelease) {
      return this.githubLatestRelease
    }

    const url = `https://api.github.com/repos/${this.githubUser}/${this.githubRepoName}/releases/latest`
    const request = new Request(url)
    request.headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }

    let asseturl = ''
    const response = await request.loadJSON()
    for (const asset of response.assets) {
      if (asset.name === 'egmp-bluelink.js') {
        asseturl = asset.browser_download_url
      }
    }

    this.githubLatestRelease = {
      version: response.tag_name,
      name: response.name,
      date: response.published_at,
      url: asseturl,
    }
    return this.githubLatestRelease
  }
}
