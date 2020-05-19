import { useState, useEffect, useCallback } from 'react'

const getWindowDimensions = () => {
  const { innerWidth: width, innerHeight: height } = window
  return {
    width,
    height
  }
}

const useWindowDimensions = () => {
  const [windowDimensions, setWindowDimensions] = useState(
    getWindowDimensions()
  )

  const handleResize = useCallback(() => {
    setWindowDimensions(getWindowDimensions())
  }, [])

  useEffect(() => {
    if (!handleResize) return
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [handleResize])

  return windowDimensions
}

export default useWindowDimensions
