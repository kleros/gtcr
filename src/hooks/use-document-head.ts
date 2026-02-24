import { useEffect } from 'react'

const useDocumentHead = (title?: string, description?: string) => {
  useEffect(() => {
    if (title) document.title = title
  }, [title])

  useEffect(() => {
    if (!description) return
    let meta = document.querySelector(
      'meta[name="description"]',
    ) as HTMLMetaElement | null
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.append(meta)
    }
    meta.content = description
  }, [description])
}

export default useDocumentHead
