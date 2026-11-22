import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form, Formik } from 'formik'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'
import { TextField } from './factory-shared-fields'

// TextField never reaches the wallet; keep AppKit out of the test.
vi.mock('config/wagmi', () => ({ appKitModal: null }))

type FieldProps = Omit<React.ComponentProps<typeof TextField>, 'name' | 'label'>

/** One TextField in a Formik form, with what the form stores shown under it. */
const Harness = ({
  initial = '',
  validate,
  ...props
}: FieldProps & {
  initial?: string
  validate?: (values: { value: string }) => object
}) => (
  <Formik
    initialValues={{ value: initial }}
    validate={validate}
    onSubmit={() => {}}
  >
    {({ values }) => (
      <Form>
        <TextField name="value" label="Submission deposit" {...props} />
        <p>Stored: {JSON.stringify(values.value)}</p>
      </Form>
    )}
  </Formik>
)

const field = () => screen.getByRole('textbox', { name: 'Submission deposit' })
const stored = () => screen.getByText(/^Stored:/)

describe('TextField', () => {
  it('is a text box named by its label and described by its help, with its unit', () => {
    renderWithProviders(
      <Harness help="Paid by whoever submits an entry." unit="xDAI" />,
    )
    expect(field()).toHaveAccessibleDescription(
      'Paid by whoever submits an entry.',
    )
    expect(field()).not.toHaveAttribute('aria-invalid')
    expect(screen.getByText('xDAI')).toBeInTheDocument()
  })

  it('stores what is typed', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness />)
    await user.type(field(), '12.5')
    expect(field()).toHaveValue('12.5')
    expect(stored()).toHaveTextContent('Stored: "12.5"')
  })

  it('shows its message once it has been left, tied to the box', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <Harness
        help="Paid by whoever submits an entry."
        validate={(values) =>
          values.value ? {} : { value: 'Enter a deposit.' }
        }
      />,
    )
    // Not while it is first filled in.
    await user.click(field())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.tab()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter a deposit.',
    )
    expect(field()).toHaveAttribute('aria-invalid', 'true')
    expect(field()).toHaveAccessibleDescription(
      'Paid by whoever submits an entry. Enter a deposit.',
    )

    await user.type(field(), '3')
    await user.tab()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(field()).not.toHaveAttribute('aria-invalid')
  })

  it('numeric: leaves "0,5" alone while typing and stores 0.5 once left', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness numeric />)
    expect(field()).toHaveAttribute('inputmode', 'decimal')
    await user.type(field(), '0,5')
    expect(field()).toHaveValue('0,5')
    await user.tab()
    expect(field()).toHaveValue('0.5')
    expect(stored()).toHaveTextContent('Stored: "0.5"')
  })

  it('numeric: never reads a thousands group typed one key at a time as a decimal', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness numeric />)
    await user.type(field(), '1,000')
    await user.tab()
    // Ambiguous: left as typed for the step's own check to refuse.
    expect(field()).toHaveValue('1,000')
  })

  it('numeric: the check that runs last reads the tidied text', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <Harness
        numeric
        validate={(values) =>
          /^\d+(\.\d+)?$/.test(values.value) ? {} : { value: 'Use a number.' }
        }
      />,
    )
    await user.type(field(), '0,5')
    await user.tab()
    expect(field()).toHaveValue('0.5')
    // Let every check settle: none may leave the "0,5" verdict behind.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(field()).not.toHaveAttribute('aria-invalid')
  })

  it('mono: drops the spaces pasted around an address, and spell-checks nothing', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness mono />)
    expect(field()).toHaveAttribute('spellcheck', 'false')
    expect(field()).toHaveAttribute('autocapitalize', 'none')
    await user.click(field())
    await user.paste('  0x66260C69d03837016d88c9877e61e08Ef74C59F2 \n')
    expect(field()).toHaveValue('0x66260C69d03837016d88c9877e61e08Ef74C59F2')
  })

  it('runs its own tidy-up once the field is left', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <Harness normalize={(text) => text.toLowerCase().trim()} />,
    )
    await user.type(field(), ' PDF PNG ')
    expect(field()).toHaveValue(' PDF PNG ')
    await user.tab()
    expect(field()).toHaveValue('pdf png')
    expect(stored()).toHaveTextContent('Stored: "pdf png"')
  })
})
