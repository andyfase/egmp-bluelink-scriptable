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
  private maxSize: number
  private fm: FileManager

  constructor(filename: string, maxSize?: number) {
    this.filepath = `${SCRIPTABLE_DIR}/${filename}`
    this.maxSize = maxSize || DEFAULT_MAX_SIZE
    this.fm = FileManager.iCloud()
  }

  private rotateFileIfNeeded() {
    if (this.fm.fileSize(this.filepath) > this.maxSize) {
      const date = new Date()
      const df = new DateFormatter()
      df.dateFormat = 'yyyyMMddHHmmssZ'
      this.fm.move(this.filepath, this.filepath + '.' + df.string(date))
    }
  }

  private formatLogEntry(data: string): string {
    const date = new Date()
    return `${date.toLocaleDateString(undefined, loggingDateStringOptions)} - ${data}`
  }

  private writeFile(data: string) {
    this.fm.writeString(this.filepath, data)
  }

  private readFile(): string {
    if (this.fm.fileExists(this.filepath)) return this.fm.readString(this.filepath)
    return ''
  }

  public log(input: string) {
    this.rotateFileIfNeeded()
    let currentData = this.readFile()
    currentData = currentData + '\n' + this.formatLogEntry(input)
    this.writeFile(currentData)
  }
}
