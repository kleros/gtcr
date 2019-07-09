import { configureStore } from 'redux-starter-kit'
import factoryWizard from './factory-wizard'

const store = configureStore({
  devTools: process.env.NODE_ENV !== 'production',
  reducer: {
    factoryWizard
  }
})

export default store
