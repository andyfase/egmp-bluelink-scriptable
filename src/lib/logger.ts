const SCRIPTABLE_DIR = '/var/mobile/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents'
const DEFAULT_MAX_SIZE = 100
const REDACTED = '***REDACTED***'
const SENSITIVE_KEYS = new Set([
  'authorization',
  'authentication',
  'cookie',
  'set-cookie',
  'refreshtoken',
  'refresh_token',
  'accesstoken',
  'id_token',
  'access_token',
  'token',
  'password',
  'username',
  'pin',
  'clientsecret',
  'secret',
  'session',
  'code',
])

const loggingDateStringOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
} as Intl.DateTimeFormatOptions

function normalizeKey(input: string): string {
  return input.toLowerCase().replaceAll('-', '').replaceAll('_', '')
}

function shouldRedactKey(key: string): boolean {
  const normalized = normalizeKey(key)
  return Array.from(SENSITIVE_KEYS).some((sensitiveKey) => normalizeKey(sensitiveKey) === normalized)
}

function redactStringPatterns(input: string): string {
  let output = input

  output = output.replace(/\b(Bearer)\s+[A-Za-z0-9\-._~+/]+=*/gi, `$1 ${REDACTED}`)

  const keyPattern = [
    'authorization',
    'authentication',
    'cookie',
    'set-cookie',
    'refreshToken',
    'refresh_token',
    'accessToken',
    'id_token',
    'access_token',
    'token',
    'password',
    'username',
    'pin',
    'clientSecret',
    'secret',
    'session',
    'code',
  ].join('|')

  output = output.replace(new RegExp(`(${keyPattern})\\s*[:=]\\s*["']?([^&\\s"',}]+)["']?`, 'gi'), `$1=${REDACTED}`)
  return output
}

function sanitizeObject(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeObject(item))
  }

  if (!input || typeof input !== 'object') {
    return input
  }

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (shouldRedactKey(key)) {
      out[key] = REDACTED
      continue
    }
    if (typeof value === 'string') {
      out[key] = redactStringPatterns(value)
      continue
    }
    out[key] = sanitizeObject(value)
  }
  return out
}

export function sanitizeForLog(input: unknown): string {
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input)
      return JSON.stringify(sanitizeObject(parsed))
    } catch (_error) {
      return redactStringPatterns(input)
    }
  }

  if (input instanceof Error) {
    return redactStringPatterns(input.stack || input.message)
  }

  try {
    return JSON.stringify(sanitizeObject(input))
  } catch (_error) {
    return redactStringPatterns(String(input))
  }
}

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
      this.previousFilepath = this.filepath.slice(0, this.filepath.length - 4) + '_' + df.string(date) + '.log'
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

  public log(input: unknown) {
    this.rotateFileIfNeeded()
    let currentData = this.readFile()
    currentData = currentData + '\n' + this.formatLogEntry(sanitizeForLog(input))
    this.writeFile(currentData)
  }

  private redact(filepath: string): string {
    let contents = ''
    if (this.fm.fileExists(filepath)) {
      contents = this.fm.readString(filepath)

      const attributes = [
        'Accesstoken',
        'Authorization',
        'Authentication',
        'refreshToken',
        'refresh_token',
        'sid',
        'password',
        'username',
        'email',
        'userId',
        'loginId',
        'pin',
        'blueLinkServicePin',
      ]

      for (const attr of attributes) {
        // Matches:
        //   key":"value"
        //   key=value&
        //   \"key\":\"value\" (JSON-in-string)
        //   key=...&
        const regex = new RegExp(
          `${attr}"\\s*:\\s*".*?"|${attr}=.*?&|\\\\?"${attr}\\\\?"\\s*:\\s*\\\\?".*?\\\\?"`,
          'gi',
        )
        contents = contents.replaceAll(regex, (match) => {
          if (match.includes('":') || match.includes('\\"')) {
            // Handles both normal and escaped JSON
            return match.startsWith('\\') ? `\\"${attr}\\":\\"REDACTED\\"` : `${attr}":"REDACTED"`
          } else {
            return `${attr}=REDACTED&`
          }
        })
      }
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
