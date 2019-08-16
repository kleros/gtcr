export default file =>
  new Promise(resolve => {
    const request = new XMLHttpRequest()
    request.open('GET', file, true)
    request.responseType = 'blob'
    request.addEventListener('load', () => {
      const reader = new FileReader()
      reader.onloadend = () => {
        resolve(Buffer.from(reader.result))
      }
      reader.readAsArrayBuffer(request.response)
    })
    request.send()
  })
