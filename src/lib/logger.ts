const SCRIPTABLE_DIR = '/var/mobile/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents'
const DEFAULT_MAX_SIZE = 100

const loggingDateStringOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
} as Intl.DateTimeFormatOptions

export class Logger {
  private filepath: string
  private previousFilepath: string | undefined
  private maxSize: number
  private fm: FileManager

  constructor(filename: string, maxSize?: number) {
    this.filepath = `${SCRIPTABLE_DIR}/${filename}`
    this.previousFilepath = ''
    this.maxSize = maxSize || DEFAULT_MAX_SIZE
    this.fm = FileManager.iCloud()
  }

  private rotateFileIfNeeded() {
    if (this.fm.fileSize(this.filepath) > this.maxSize) {
      const date = new Date()
      const df = new DateFormatter()
      df.dateFormat = 'yyyyMMddHHmmssZ'
      this.previousFilepath = this.filepath + '.' + df.string(date)
      this.fm.move(this.filepath, this.previousFilepath)
    }
  }

  private formatLogEntry(data: string): string {
    const date = new Date()
    return `${date.toLocaleDateString(undefined, loggingDateStringOptions)} - ${data}`
  }

  private writeFile(data: string) {
    this.fm.writeString(this.filepath, data)
  }

  private readFile(filepath?: string): string {
    if (this.fm.fileExists(filepath || this.filepath)) return this.fm.readString(filepath || this.filepath)
    return ''
  }

  public log(input: string) {
    this.rotateFileIfNeeded()
    let currentData = this.readFile()
    currentData = currentData + '\n' + this.formatLogEntry(input)
    this.writeFile(currentData)
  }

  private redact(filepath: string): string {
    let contents = ''
    if (this.fm.fileExists(filepath)) {
      contents = this.fm.readString(filepath)
      contents = contents.replaceAll(/Accesstoken":".*?"/gi, 'Accesstoken":"REDACTED"')
      contents = contents.replaceAll(/password":".*?"/gi, 'password":"REDACTED"')
      contents = contents.replaceAll(/username":".*?"/gi, 'username":"REDACTED"')
      contents = contents.replaceAll(/password=.*?&/gi, 'password=REDACTED&')
      contents = contents.replaceAll(/username=.*?&/gi, 'username=REDACTED&')
      contents = contents.replaceAll(/pin":".*?"/gi, 'pin":"REDACTED"')
    }
    return contents
  }

  public read(): string {
    return this.previousFilepath
      ? `${this.readFile(this.previousFilepath)}\n${this.readFile(this.filepath)}`
      : this.readFile(this.filepath)
  }

  public readAndRedact(): string {
    return this.previousFilepath
      ? `${this.redact(this.previousFilepath)}\n${this.redact(this.filepath)}`
      : this.redact(this.filepath)
  }
}
