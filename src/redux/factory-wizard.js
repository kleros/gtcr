import { createAction, createReducer } from 'redux-starter-kit'

export const nextStep = createAction('nextStep')
export const previousStep = createAction('previousStep')
export const stepTo = createAction('stepTo')

export default createReducer(
  {
    currStep: 1,
    numSteps: 3
  },
  {
    [nextStep]: state => {
      state.currStep =
        state.currStep + 1 > state.numSteps
          ? state.numSteps
          : state.currStep + 1
    },
    [previousStep]: state => {
      state.currStep = state.currStep - 1 < 1 ? 1 : state.currStep - 1
    },
    [stepTo]: (state, action) => {
      state.currStep =
        action.payload > state.numSteps
          ? state.numSteps
          : action.payload < 1
          ? 1
          : action.payload
    }
  }
)
