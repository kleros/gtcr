import { uploadFormDataToIPFS } from './upload-form-data-to-ipfs'

const mirroredExtensions = ['.json']

/**
 * Send file to IPFS network.
 * @param {string} fileName - The name that will be used to store the file. This is useful to preserve extension type.
 * @param {ArrayBuffer} data - The raw data from the file to upload.
 * @returns {object} ipfs response. Should include the hash and path of the stored item.
 */
export default async function ipfsPublish(fileName: string, data: Blob | ArrayBuffer): Promise<IpfsPublishResult> {
  const isBlob = data instanceof Blob
  const blobFile = isBlob
    ? data
    : new Blob([data], { type: 'application/json' })

  const fileFormData = new FormData()
  fileFormData.append('data', blobFile, fileName)

  if (!mirroredExtensions.some(ext => fileName.endsWith(ext))) {
    const result = await uploadFormDataToIPFS(fileFormData)
    return result
  }

  const result = await uploadFormDataToIPFS(fileFormData, 'file', false)

  if (result.inconsistentCids.length > 0) {
    console.warn('IPFS upload result is different:', {
      inconsistentCids: result.inconsistentCids
    })
    throw new Error('IPFS upload result is different.')
  }

  return result
}
