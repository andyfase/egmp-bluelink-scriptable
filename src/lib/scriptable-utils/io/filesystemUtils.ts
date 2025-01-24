import { map, toSegmented } from '../arrayTransducers'
import { getBookmarkedPath } from '../common'
import { confirm } from '../input/confirm'
import { filterJoin } from '../object'
import { lowerEquals, lowerIncludes } from '../string'
import { DocumentsDir, DOCUMENTS_SUB_DIRECTORY_NAMES, FileInfo } from './types'

export const PROJECT_ARCHIVE_DIR_NAME = '*Archive'

/** Get the path to one of the 3 core subdirectories of Documents. */
export const getDocumentsChildDirPath = (dirKey: DocumentsDir) => {
  const docsPath = getBookmarkedPath('Documents')
  return docsPath ? `${docsPath}/${DOCUMENTS_SUB_DIRECTORY_NAMES[dirKey]}` : null
}

export const getProjectsRootPath = () => getDocumentsChildDirPath('project')

export const getDocumentsCategoryChildDirPath = (category: DocumentsDir, dirName: string) => {
  const childDirPath = getBookmarkedPath('Documents')
  return childDirPath ? `${childDirPath}/${dirName}` : null
}

export const getProjectPath = (projName: string) => getDocumentsCategoryChildDirPath('project', projName)

export const createDirIfNotExists = (dirPath: string) => {
  const f = FileManager.iCloud()
  if (!f.fileExists(dirPath)) f.createDirectory(dirPath)
  return dirPath
}

export const createDocumentsSubdirectoryIfNotExists = (category: DocumentsDir, dirName: string) => {
  const childPath = getDocumentsChildDirPath(category)
  return childPath ? createDirIfNotExists(`${childPath}/${dirName}`) : null
}

/** Returns dir path for this month's archived files */
export const getArchiveDir = () => {
  const now = new Date()
  const year = String(now.getFullYear())
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const yearPath = createDocumentsSubdirectoryIfNotExists('archive', year)
  return yearPath ? createDirIfNotExists(`${yearPath}/${month}`) : null
}

export const createFileDirForProjectIfNotExists = (projName: string) =>
  createDocumentsSubdirectoryIfNotExists('project', projName)

export const getFileInfo = (path: string): FileInfo => {
  const f = FileManager.iCloud()
  return {
    filepath: path,
    filename: f.fileName(path, true),
    created: f.creationDate(path),
    modified: f.modificationDate(path),
    isDirectory: f.isDirectory(path),
    extension: f.fileExtension(path) || null,
    filenameNoExtension: f.fileName(path, false),
    sizeInKb: f.fileSize(path),
    isDownloaded: f.isFileDownloaded(path),
  }
}

export const getDirContents = (filePath: string) =>
  FileManager.iCloud()
    .listContents(filePath)
    .map((childName) => getFileInfo(`${filePath}/${childName}`))

const getActiveFileProjectsInfo = () => {
  const projectPath = getProjectsRootPath()
  return (projectPath ? getDirContents(projectPath) : []).filter(
    ({ isDirectory, filenameNoExtension }) => isDirectory && filenameNoExtension !== PROJECT_ARCHIVE_DIR_NAME,
  )
}

export const getProjectDirContents = (projName: string) => {
  const allProjectFolders = getActiveFileProjectsInfo()
  const match = allProjectFolders.find(({ filenameNoExtension }) => lowerEquals(filenameNoExtension, projName))
  if (!match) {
    throw new Error(`Project ${projName} not found in projects folder`)
  }
  const projPath = getProjectPath(match.filenameNoExtension)
  return projPath ? getDirContents(projPath) : null
}

export const getArchivedProjectFilepath = (projName: string) => {
  const docsPath = getBookmarkedPath('Documents')
  return docsPath
    ? `${docsPath}/${DOCUMENTS_SUB_DIRECTORY_NAMES.project}/${PROJECT_ARCHIVE_DIR_NAME}/${projName}`
    : null
}

type GetSafeFilePathOpts = {
  parentDirPath: string
  filename: string
  // Null if directory
  fileExtension: string | null
  i?: number
  f?: FileManager
}
type GetSafeFilePathReturn = { path: string; didRename: boolean }
/** Appends # to file name until it doesn't exist in path */
const getSafeFilePath = ({
  i = 0,
  f = FileManager.iCloud(),
  ...pathOpts
}: GetSafeFilePathOpts): GetSafeFilePathReturn => {
  const { parentDirPath, filename, fileExtension } = pathOpts
  const desiredFilePath = filterJoin([
    `${parentDirPath}/${filename}`,
    i && ` ${encodeURIComponent(`(${i})`)}`,
    fileExtension && `.${fileExtension}`,
  ])
  return f.fileExists(desiredFilePath)
    ? getSafeFilePath({ ...pathOpts, i: i + 1, f })
    : { didRename: i !== 0, path: desiredFilePath }
}

type SafelyMoveFileOpts = {
  sourceFilePath: string
  targetParentDirPath: string
  targetFilename: string
  targetFileExtension?: string | null
  silentlyRename?: boolean
}
/** Checks if file already exists at target location; if so, propose an
 * alternative name */
const safelyMoveFile = async ({
  sourceFilePath,
  targetParentDirPath,
  targetFilename,
  targetFileExtension = null,
  silentlyRename = false,
}: SafelyMoveFileOpts) => {
  const f = FileManager.iCloud()
  const { didRename, path: safeTargetFilePath } = getSafeFilePath({
    parentDirPath: targetParentDirPath,
    filename: targetFilename,
    fileExtension: targetFileExtension,
  })
  if (didRename) {
    const newFilename = safeTargetFilePath.split('/').at(-1)
    const approved =
      silentlyRename ||
      (await confirm('Rename to avoid naming conflict', {
        message: `Update filename to ${newFilename} to avoid naming conflict?`,
        confirmButtonTitle: 'OK',
      }))
    if (!approved) return false
  }
  f.move(sourceFilePath, safeTargetFilePath)
  return true
}

export const moveFile = (filePath: string, targetParentDirPath: string, silentlyRename = false) => {
  const { filenameNoExtension, extension } = getFileInfo(filePath)
  return safelyMoveFile({
    sourceFilePath: filePath,
    targetParentDirPath,
    targetFilename: filenameNoExtension,
    targetFileExtension: extension,
    silentlyRename,
  })
}

export const archiveProject = async (projName: string, silentlyRename = false) => {
  const sourcePath = getProjectPath(projName)
  const targetPath = getProjectPath(PROJECT_ARCHIVE_DIR_NAME)
  if (!(sourcePath && targetPath)) return false
  return await moveFile(sourcePath, targetPath, silentlyRename)
}

export const renameFile = (filePath: string, newFilenameNoExtension: string, silentlyRename = false) => {
  const pathComponents = filePath.split('/')
  const targetParentDirPath = pathComponents.slice(0, -1).join('/')
  return safelyMoveFile({
    sourceFilePath: filePath,
    targetParentDirPath,
    targetFilename: newFilenameNoExtension,
    targetFileExtension: getFileInfo(filePath).extension,
    silentlyRename,
  })
}

export const getOpenFileUrl = (filePath: string) =>
  `shareddocuments://${filePath.split('/').map(encodeURIComponent).join('/')}`

// https://www.macstories.net/ios/fs-bookmarks-a-shortcut-to-reopen-files-and-folders-directly-in-the-files-app/
export const openFileInFiles = (filePath: string) => Safari.open(getOpenFileUrl(filePath))

type RecursiveSearchOpts = {
  includeDirectories?: boolean
  filterFilenameByString?: string
}
/** Return matching filepaths under the root directory. By default only returns
 * filepaths for files, not directories. Filtering by filename does not look at
 * the file's path, only its filename. */
const recursiveFilepathSearch = (rootPath: string, opts: RecursiveSearchOpts = {}): string[] => {
  const { includeDirectories = false, filterFilenameByString } = opts
  const fm = FileManager.iCloud()
  const { filePaths, directoryPaths } = toSegmented(
    fm.listContents(rootPath),
    map((childName) => `${rootPath}/${childName}`),
    { filePaths: (path) => !fm.isDirectory(path), directoryPaths: 'UNMATCHED' },
  )
  const filterPath = (path: string) =>
    filterFilenameByString ? lowerIncludes(fm.fileName(path, false), filterFilenameByString) : true
  return [
    ...filePaths.filter(filterPath),
    ...(includeDirectories ? directoryPaths.filter(filterPath) : []),
    ...directoryPaths.flatMap((path) => recursiveFilepathSearch(path, opts)),
  ]
}

const MAX_SEARCH_FILES_RESPONSES = 200
/** Search all files (not directories) under a root path whose filename
 * (excluding extension) includes the given query.
 *
 * NB that this truncates search results if over a threshhold. Traversing all
 * files is fast, but mapping a large number of filePaths to `FileInfo` objects
 * can get quite slow. */
export const searchFiles = (rootPath: string, query: string) => {
  const allFilePaths = recursiveFilepathSearch(rootPath, {
    filterFilenameByString: query,
  })
  return allFilePaths.slice(0, MAX_SEARCH_FILES_RESPONSES).map(getFileInfo)
}
