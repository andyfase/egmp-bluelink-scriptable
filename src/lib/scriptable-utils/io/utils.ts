import { getConfig } from '../configRegister'
import { Stream } from '../streams'
import { MapFn } from '../types/utilTypes'
import { getDirContents } from './filesystemUtils'
import persisted from './persisted'

export const temporaryFilenamePrefix = 'tmp_'

/** Generates a filename indicative of a temporary file that can be cleaned up. */
export const getTemporaryFilename = () => `${temporaryFilenamePrefix}${UUID.string()}`

const getTmpFilePaths = () => {
  const allFilesInStore = getDirContents(getConfig('SCRIPTABLE_STORE_PATH'))
  return allFilesInStore.filter(
    ({ filenameNoExtension }) =>
      filenameNoExtension.startsWith(temporaryFilenamePrefix) ||
      filenameNoExtension.startsWith(`.${temporaryFilenamePrefix}`),
  )
}

/** Deletes all temporary files that exist in the Scriptable `store` directory
 * - this is a custom directory that I use for persisted data files. These
 *   temporary files are used by things like `PersistedCache` to temporarily
 *   store data.  */
export const cleanupTemporaryFiles = async () => {
  const tempFilenames = getTmpFilePaths()
  for (const { filenameNoExtension } of tempFilenames) {
    const io = persisted<any>({
      filename: filenameNoExtension,
      defaultData: null,
    })
    // Ensure file is downloaded first, otherwise may not be deleted.
    await io.getData()
    io.deleteFile()
  }
  return { numDeletedTempFiles: tempFilenames.length }
}

//

export type RobustCleanupStatus = 'READY' | 'CLEANING' | 'FAIL' | 'SUCCESS'

type RobustCleanup$Data = {
  numRemainingTmpFiles: number
  numRemoved: number
  numFailures: number
  numDownloaded: number
  status: RobustCleanupStatus
}

/** Used for views to plug into status of running function. */
export const robustCleanup$ = new Stream<RobustCleanup$Data>({
  name: 'robustCleanup$',
  defaultState: {
    status: 'READY',
    numFailures: 0,
    numRemainingTmpFiles: 0,
    numDownloaded: 0,
    numRemoved: 0,
  },
})

const update$Attrs = (updater: MapFn<RobustCleanup$Data, Partial<RobustCleanup$Data>>) =>
  robustCleanup$.updateData((data) => ({ ...data, ...updater(data) }))

const robustCleanupRecur = async (i = 0) => {
  if (i > 30) {
    update$Attrs(() => ({ status: 'FAIL' }))
    return
  }
  const filePathsToDelete = getTmpFilePaths()
  if (filePathsToDelete.length === 0) {
    update$Attrs(() => ({ status: 'SUCCESS', numRemainingTmpFiles: 0 }))
    return
  }
  const firstPath = filePathsToDelete[0]!.filepath
  try {
    const io = FileManager.iCloud()
    if (!io.isFileDownloaded(firstPath)) {
      await io.downloadFileFromiCloud(firstPath)
      update$Attrs(({ numDownloaded }) => ({
        numDownloaded: numDownloaded + 1,
      }))
    }
    io.remove(firstPath)
    update$Attrs(({ numRemoved, numRemainingTmpFiles }) => ({
      numRemoved: numRemoved + 1,
      numRemainingTmpFiles: numRemainingTmpFiles - 1,
    }))
  } catch {
    update$Attrs(({ numFailures }) => ({ numFailures: numFailures + 1 }))
  } finally {
    robustCleanupRecur(i + 1)
  }
}

/** `cleanupTemporaryFiles` is hit or miss with not-downloaded tmp files. This
 * function uses a timer and try/catch to keep trying to download the files and
 * remove them. */
export const robustCleanupTemporaryFiles = () => {
  const numRemainingTmpFiles = getTmpFilePaths().length
  const willRun = Boolean(numRemainingTmpFiles)
  robustCleanup$.setData({
    status: willRun ? 'CLEANING' : 'SUCCESS',
    numDownloaded: 0,
    numFailures: 0,
    numRemainingTmpFiles,
    numRemoved: 0,
  })
  if (willRun) robustCleanupRecur()
}
