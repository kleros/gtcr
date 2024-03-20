import { useHistory } from 'react-router-dom'

const useNavigateAndScrollTop = () => {
  const history = useHistory()

  const navigateAndScrollTop = path => {
    history.push(path)
    window.scrollTo(0, 0)
  }

  return navigateAndScrollTop
}

export default useNavigateAndScrollTop
