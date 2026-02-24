import React from 'react'
import { useNavigate } from 'react-router-dom'

const useNavigateAndScrollTop = () => {
  const navigate = useNavigate()

  const navigateAndScrollTop = (path: string): void => {
    navigate(path)
    window.scrollTo(0, 0)
  }

  const getLinkProps = (path: string) => ({
    href: path,
    onClick: (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      e.preventDefault()
      navigateAndScrollTop(path)
    },
  })

  return { navigateAndScrollTop, getLinkProps }
}

export default useNavigateAndScrollTop
