import deepEqual from 'fast-deep-equal/es6'
import { uploadFormDataToIPFS } from './upload-form-data-to-ipfs'

const mirroredExtensions = ['.json']

export default async function ipfsPublish(fileName, file) {
  const isBlob = file instanceof Blob
  const blobFile = isBlob
    ? file
    : new Blob([file], { type: 'application/json' })

  const fileFormData = new FormData()
  fileFormData.append('data', blobFile, fileName)

  if (!mirroredExtensions.some(ext => fileName.endsWith(ext)))
    return uploadFormDataToIPFS(fileFormData)

  const [klerosResponse, theGraphResult] = await Promise.all([
    uploadFormDataToIPFS(fileFormData),
    publishToTheGraphNode(fileName, file)
  ])

  const klerosData = await klerosResponse.json()
  const klerosHash = klerosData.cids[0].split('ipfs://')[1].split('/')[0]

  console.log(klerosData)

  const normalizedKlerosResult = {
    name: fileName,
    hash: klerosHash
  }

  console.log(theGraphResult)

  const normalizedTheGraphResult = {
    name: fileName,
    hash: theGraphResult[1].hash
  }

  if (!deepEqual(normalizedKlerosResult, normalizedTheGraphResult)) {
    console.warn('IPFS upload result is different:', {
      kleros: normalizedKlerosResult,
      theGraph: normalizedTheGraphResult
    })
    throw new Error('IPFS upload result is different.')
  }

  return theGraphResult
}

/**
 * Send file to IPFS network via the Kleros IPFS node
 * @param {string} fileName - The name that will be used to store the file. This is useful to preserve extension type.
 * @param {ArrayBuffer} data - The raw data from the file to upload.
 * @returns {object} ipfs response. Should include the hash and path of the stored item.
 */
// async function publishToKlerosNode(fileName, data) {
//   console.log('Publishing to KlerosNode with:', fileName)
//   const buffer = await Buffer.from(data)
//   const url = `${process.env.REACT_APP_IPFS_GATEWAY}/add`

//   console.log('Sending POST request to Kleros IPFS node.')
//   const response = await fetch(url, {
//     method: 'POST',
//     body: JSON.stringify({
//       fileName,
//       buffer
//     }),
//     headers: {
//       'content-type': 'application/json'
//     }
//   })

//   const body = await response.json()
//   console.log('Received response from Kleros IPFS node:', body.data)
//   return body.data
// }

async function publishToTheGraphNode(fileName, data) {
  const url = `${process.env.REACT_APP_HOSTED_GRAPH_IPFS_ENDPOINT}/api/v0/add?wrap-with-directory=true`

  const payload = new FormData()
  payload.append('file', new Blob([data]), fileName)

  const response = await fetch(url, {
    method: 'POST',
    body: payload
  })

  const result = await jsonStreamToPromise(response.body)

  return result.map(({ Name, Hash }) => ({
    hash: Hash,
    path: `/${Name}`
  }))
}

/**
 * Accumulates a JSON stream body into an array of JSON objects.
 * @param {ReadableStream} stream The stream to read from.
 * @returns {Promise<any>} An array of all JSON objects emitted by the stream.
 */
async function jsonStreamToPromise(stream) {
  const reader = stream.getReader()
  const decoder = new TextDecoder('utf-8')

  const deferred = {
    resolve: undefined,
    reject: undefined
  }

  const result = new Promise((resolve, reject) => {
    deferred.resolve = resolve
    deferred.reject = reject
  })

  const acc = []
  const start = async () => {
    reader
      .read()
      .then(({ done, value }) => {
        if (done) return deferred.resolve(acc)

        // Each `read` can produce one or more lines...
        const lines = decoder.decode(value).split(/\n/)
        const objects = lines
          .filter(line => line.trim() !== '')
          .map(line => JSON.parse(line))
        acc.push(...objects)

        return start()
      })
      .catch(err => deferred.reject(err))
  }

  start()

  return result
}
