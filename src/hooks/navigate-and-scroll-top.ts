import { useNavigate } from 'react-router-dom'

const useNavigateAndScrollTop = () => {
  const navigate = useNavigate()

  const navigateAndScrollTop = (path: string): void => {
    navigate(path)
    window.scrollTo(0, 0)
  }

  return navigateAndScrollTop
}

export default useNavigateAndScrollTop
