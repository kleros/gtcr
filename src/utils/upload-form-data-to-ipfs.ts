import { fetch } from 'cross-fetch'

export async function uploadFormDataToIPFS(
  formData: FormData,
  operation: string = 'evidence',
  pinToGraph = false
): Promise<Response> {
  const url = `${process.env.REACT_APP_COURT_FUNCTIONS_URL}/.netlify/functions/upload-to-ipfs?operation=${operation}&pinToGraph=${pinToGraph}`

  const response = await fetch(url, {
    method: 'POST',
    body: formData
  })

  if (response.status !== 200) {
    const error = await response
      .json()
      .catch(() => ({ message: 'Error uploading to IPFS' }))
    throw new Error(error.message)
  }
  const data = await response.json()
  return data
}
