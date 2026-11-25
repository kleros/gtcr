import type { Roles } from '@kleros/kleros-app'

type UploadFile = (file: File, role: Roles) => Promise<string | null>

/**
 * Uploads a JSON file the app wrote (a new list's MetaEvidence) unless the
 * same text already went up under the same role: then it gives the path that
 * upload returned. An IPFS path is the address of its content, so it is the
 * path a second upload would return; what is spared is Atlas's limit of 5
 * uploads a minute per wallet. A list deploy cancelled in the wallet and sent
 * again at once uploaded its four files a second time and was refused.
 *
 * `known` holds the paths, for as long as the page keeps it. Other files, a
 * failed upload and an empty answer (not signed in) are not remembered.
 */
export const uploadOnce = async (
  uploadFile: UploadFile,
  known: Map<string, string>,
  file: File,
  role: Roles,
): Promise<string | null> => {
  if (file.type !== 'application/json') return uploadFile(file, role)
  const key = `${role}\n${await file.text()}`
  const path = known.get(key)
  if (path) return path
  const uploaded = await uploadFile(file, role)
  if (uploaded) known.set(key, uploaded)
  return uploaded
}
