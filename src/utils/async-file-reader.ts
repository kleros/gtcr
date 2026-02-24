/**
 * Wraps FileReader in a promise.
 * @param {string} file The path to the blob we want to read.
 * @returns {object} A promise version of FileReader.
 */
export default function asyncReadFile(file: Blob): Promise<string[]> {
  return new Promise((resolve, reject) => {
    let content = ''
    const reader = new FileReader()
    reader.onloadend = (e: ProgressEvent<FileReader>) => {
      content = e.target?.result as string
      const result = content.split(/\r\n|\n/)
      resolve(result)
    }
    reader.addEventListener('error', (e: ProgressEvent<FileReader>) => {
      reject(e)
    })
    reader.readAsDataURL(file)
  })
}
