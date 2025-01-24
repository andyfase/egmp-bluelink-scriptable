export type FileInfo = {
  filepath: string
  filename: string
  created: Date | null
  modified: Date | null
  isDirectory: boolean
  /** Without period */
  extension: string | null
  filenameNoExtension: string
  sizeInKb: number
  isDownloaded: boolean
}

export const DOCUMENTS_SUB_DIRECTORY_NAMES = {
  project: '1-Projects',
  reference: '2-Reference',
  archive: '3-Archive',
}
export type DocumentsDir = keyof typeof DOCUMENTS_SUB_DIRECTORY_NAMES
