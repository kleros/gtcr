import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form, Formik } from 'formik'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from 'test/render'
import {
  FactoryStepPanel,
  useFactoryWizard,
  type FactoryStepDescriptor,
  type FactoryWizardStep,
} from './v2-factory-shell'

/*
 * Both list factories move through their steps with this panel. Each step
 * below is a form whose values already pass, as Deposit and Item name do
 * with their defaults: Next moves on at the first press.
 */

const GROUPS: FactoryStepDescriptor[] = [
  { title: 'List', description: 'Name' },
  { title: 'Item', description: 'Item name' },
  { title: 'Deposit', description: 'Amounts' },
]

const STEPS: FactoryWizardStep[] = [
  { title: 'Name', componentStep: 1, groupStep: 1 },
  { title: 'Item name', componentStep: 2, groupStep: 2 },
  { title: 'Deposit', componentStep: 3, groupStep: 3 },
]

const Wizard = () => {
  const wizard = useFactoryWizard({ steps: STEPS })
  const formId = `step-form-${wizard.index}`
  return (
    <FactoryStepPanel wizard={wizard} groups={GROUPS} formId={formId}>
      <Formik
        key={wizard.index}
        initialValues={{ value: 'filled' }}
        onSubmit={wizard.advance}
      >
        <Form id={formId}>
          <h2 tabIndex={-1}>{wizard.current.title}</h2>
        </Form>
      </Formik>
    </FactoryStepPanel>
  )
}

const step = () => screen.getByRole('heading', { level: 2 })
const next = () => screen.getByRole('button', { name: /^Next/ })
const previous = () => screen.getByRole('button', { name: 'Previous' })

describe('FactoryStepPanel', () => {
  it('moves one step per press of Next', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Wizard />)

    await user.click(next())
    expect(await screen.findByRole('heading', { name: 'Item name' })).toBe(
      step(),
    )
  })

  it('never passes a step on a double click: its second click lands on the next step’s Next', async () => {
    renderWithProviders(<Wizard />)

    // The first click moves on; the step changes under the pointer before
    // the second click of the same double click lands, on the same button.
    const button = next()
    fireEvent.click(button, { detail: 1 })
    await screen.findByRole('heading', { name: 'Item name' })
    expect(next()).toBe(button)
    fireEvent.click(button, { detail: 2 })
    // Formik submits asynchronously: give a submit the time to land.
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(step()).toHaveTextContent('Item name')
  })

  it('still moves on with a later single click, or the keyboard', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Wizard />)

    fireEvent.click(next(), { detail: 1 })
    await screen.findByRole('heading', { name: 'Item name' })
    // Enter or Space on the button: a click with no count.
    next().focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { name: 'Deposit' })).toBe(step())
  })

  it('never goes back two steps on a double click of Previous', async () => {
    renderWithProviders(<Wizard />)
    fireEvent.click(next(), { detail: 1 })
    await screen.findByRole('heading', { name: 'Item name' })
    fireEvent.click(next(), { detail: 1 })
    await screen.findByRole('heading', { name: 'Deposit' })

    fireEvent.click(previous(), { detail: 1 })
    expect(step()).toHaveTextContent('Item name')
    fireEvent.click(previous(), { detail: 2 })
    expect(step()).toHaveTextContent('Item name')
  })
})
