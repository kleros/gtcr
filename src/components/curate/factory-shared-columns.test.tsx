import React from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form, Formik } from 'formik'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from 'test/render'
import * as editor from './factory-shared-columns'

// The editor never reaches the wallet; keep AppKit out of the test.
vi.mock('config/wagmi', () => ({ appKitModal: null }))

const MAX_IDENTIFIERS = 5

/** The item step's form, reduced to the editor and its `columns` array. */
const Harness = ({
  columns,
  problem = '',
  validate,
}: {
  columns: Column[]
  problem?: string
  validate?: (values: { columns: Column[] }) => object
}) => {
  const { ColumnsEditor } = editor
  return (
    <Formik initialValues={{ columns }} validate={validate} onSubmit={() => {}}>
      {({ values, setFieldValue }) => (
        <Form>
          <ColumnsEditor
            columns={values.columns}
            setFieldValue={setFieldValue}
            problem={problem}
          />
        </Form>
      )}
    </Formik>
  )
}

const text = (label: string, isIdentifier = false): Column => ({
  label,
  description: '',
  type: 'text',
  isIdentifier,
})

const row = (index: number) =>
  screen.getByRole('group', { name: `Field ${index}` })
const rows = () => screen.queryAllByRole('group', { name: /^Field \d+$/ })
const identifier = (index: number) =>
  screen.getByRole('switch', { name: `Field ${index} identifier` })

describe('ColumnsEditor', () => {
  it(`caps the identifiers at ${MAX_IDENTIFIERS}`, () => {
    expect(editor.MAX_IDENTIFIERS).toBe(MAX_IDENTIFIERS)
  })

  it('names every field and its controls', () => {
    renderWithProviders(
      <Harness
        columns={[{ ...text('Token', true), description: 'The ticker' }]}
      />,
    )
    expect(
      screen.getByRole('group', { name: 'Entry fields' }),
    ).toBeInTheDocument()
    const first = within(row(1))
    expect(first.getByRole('textbox', { name: 'Name' })).toHaveValue('Token')
    expect(first.getByRole('textbox', { name: 'Description' })).toHaveValue(
      'The ticker',
    )
    expect(
      first.getByRole('combobox', { name: 'Field 1 type' }),
    ).toHaveTextContent('text')
    expect(identifier(1)).toBeChecked()
  })

  it('adds an address field that is not an identifier yet', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Harness columns={[text('Token', true)]} />)
    // The only field cannot be removed.
    expect(
      screen.queryByRole('button', { name: /^Remove field/ }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add a field' }))
    expect(rows()).toHaveLength(2)
    const second = within(row(2))
    expect(second.getByRole('textbox', { name: 'Name' })).toHaveValue('')
    expect(
      second.getByRole('combobox', { name: 'Field 2 type' }),
    ).toHaveTextContent('address')
    expect(identifier(2)).not.toBeChecked()
    expect(
      screen.getByRole('button', { name: 'Remove field 1' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Remove field 2' }),
    ).toBeInTheDocument()
  })

  it('removes the field its button names, and keeps the others in order', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <Harness columns={[text('Name', true), text('Ticker'), text('Logo')]} />,
    )
    await user.click(screen.getByRole('button', { name: 'Remove field 2' }))
    expect(rows()).toHaveLength(2)
    expect(within(row(1)).getByRole('textbox', { name: 'Name' })).toHaveValue(
      'Name',
    )
    expect(within(row(2)).getByRole('textbox', { name: 'Name' })).toHaveValue(
      'Logo',
    )
  })

  it(`allows at most ${MAX_IDENTIFIERS} identifiers and says why the others are off`, async () => {
    const user = userEvent.setup()
    const columns = Array.from({ length: MAX_IDENTIFIERS + 1 }, (_, index) =>
      text(`Field ${index + 1}`, index < MAX_IDENTIFIERS),
    )
    renderWithProviders(<Harness columns={columns} />)
    const last = MAX_IDENTIFIERS + 1
    expect(identifier(last)).toBeDisabled()
    expect(identifier(last)).toHaveAccessibleDescription(
      `Max ${MAX_IDENTIFIERS} reached`,
    )
    // The ones that are on can still be turned off.
    expect(identifier(1)).toBeEnabled()

    await user.click(identifier(1))
    expect(identifier(1)).not.toBeChecked()
    expect(identifier(last)).toBeEnabled()
    expect(identifier(last)).not.toHaveAccessibleDescription()

    await user.click(identifier(last))
    expect(identifier(last)).toBeChecked()
    expect(identifier(1)).toBeDisabled()
    expect(identifier(1)).toHaveAccessibleDescription(
      `Max ${MAX_IDENTIFIERS} reached`,
    )
  })

  it('never makes a long text, an image or a file an identifier', () => {
    renderWithProviders(
      <Harness
        columns={[
          text('Name', true),
          { label: 'About', type: 'long text' },
          { label: 'Logo', type: 'image' },
          { label: 'Report', type: 'file' },
        ]}
      />,
    )
    expect(identifier(2)).toBeDisabled()
    expect(identifier(2)).toHaveAccessibleDescription('Not for long text')
    expect(identifier(3)).toBeDisabled()
    expect(identifier(3)).toHaveAccessibleDescription('Not for images')
    expect(identifier(4)).toBeDisabled()
    expect(identifier(4)).toHaveAccessibleDescription('Not for files')
  })

  it('turns the identifier off when the field becomes an image', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <Harness columns={[text('Name', true), text('Logo', true)]} />,
    )
    await user.click(screen.getByRole('combobox', { name: 'Field 2 type' }))
    await user.click(screen.getByRole('option', { name: 'image' }))
    expect(
      screen.getByRole('combobox', { name: 'Field 2 type' }),
    ).toHaveTextContent('image')
    expect(identifier(2)).not.toBeChecked()
    expect(identifier(2)).toBeDisabled()
    expect(identifier(1)).toBeChecked()
  })

  it('asks a file field for its allowed file types', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <Harness columns={[text('Name', true), text('Report')]} />,
    )
    expect(
      within(row(2)).queryByRole('textbox', { name: 'Allowed file types' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('combobox', { name: 'Field 2 type' }))
    await user.click(screen.getByRole('option', { name: 'file' }))
    expect(
      within(row(2)).getByRole('textbox', { name: 'Allowed file types' }),
    ).toBeInTheDocument()
  })

  it("shows a field's message once it has been left", async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <Harness
        columns={[text('', true)]}
        validate={(values) =>
          values.columns[0].label
            ? {}
            : { columns: [{ label: 'Name the field.' }] }
        }
      />,
    )
    const name = within(row(1)).getByRole('textbox', { name: 'Name' })
    expect(name).not.toHaveAttribute('aria-invalid')
    await user.click(name)
    await user.tab()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Name the field.',
    )
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveAccessibleDescription('Name the field.')

    await user.type(name, 'Ticker')
    await user.tab()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(name).not.toHaveAttribute('aria-invalid')
  })

  it("announces the step's problem", () => {
    renderWithProviders(
      <Harness
        columns={[text('Name')]}
        problem="Mark at least one field as an identifier."
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Mark at least one field as an identifier.',
    )
  })
})
