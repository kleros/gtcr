import { fetch } from 'cross-fetch'

export function uploadFormDataToIPFS(
  formData: FormData,
  operation: string = 'evidence'
): Promise<Response> {
  const url = `/.netlify/functions/uploadToIPFS?dapp=curate&key=curate-v1&operation=${operation}`

  return fetch(url, {
    method: 'POST',
    body: formData
  }).then(async response => {
    if (response.status !== 200) {
      const error = await response
        .json()
        .catch(() => ({ message: 'Error uploading to IPFS' }))
      throw new Error(error.message)
    }
    return response
  })
}
