/**
 * Wraps FileReader in a promise.
 * @param {string} file The path to the blob we want to read.
 * @returns {object} A promise version of FileReader.
 */
export default function asyncReadFile(file) {
  return new Promise((resolve, reject) => {
    let content = ''
    const reader = new FileReader()
    // Wait till complete
    reader.onloadend = e => {
      content = e.target.result
      const result = content.split(/\r\n|\n/)
      resolve(result)
    }
    // Make sure to handle error states
    reader.addEventListener('error', e => {
      reject(e)
    })
    reader.readAsDataURL(file)
  })
}
