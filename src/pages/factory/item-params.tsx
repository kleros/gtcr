import React, { useEffect, useCallback, useId } from 'react'
import styled from 'styled-components'
import { toast } from 'react-toastify'
import { withFormik, FieldArray, useField, type FormikProps } from 'formik'
import { ItemTypes as AllItemTypes } from '@kleros/gtcr-encoder'
import objectWithoutKey from 'utils/object-without-key'
import { CurateIcon } from 'components/curate/icons'
import Switch from 'components/ui/Switch'
import { reveal } from 'components/curate/motion/reveal'
import {
  Button,
  IconButton,
  Label,
  Small,
  Stack,
} from 'components/curate/primitives'
import {
  ErrorText,
  Input,
  Select,
  StepBody,
  StepHeader,
  SwitchField,
  TextField,
} from './fields'
import { itemColumnsProblem, itemSchema } from './schemas'
import type { StepProps, TcrState } from '.'

/*
 * Step 2, the item: the fields every entry has (one row per field, a
 * column header with one line of help on wide screens, stacked labels on
 * phones) and the list-of-lists switch. The identifier rules and the two
 * submit checks (one ID field, unique names) are the ones the previous step
 * had.
 */

export const ItemTypes = objectWithoutKey(AllItemTypes, 'TWITTER_USER_ID')

const { IMAGE, FILE, GTCR_ADDRESS, LONG_TEXT } = AllItemTypes

const TYPE_OPTIONS = Object.values(ItemTypes).map((itemType) => ({
  value: String(itemType),
  label: String(itemType),
}))

const MAX_IDENTIFIERS = 5

const COLUMNS = '28px minmax(0, 1fr) minmax(0, 1.25fr) 150px 72px 34px'

const COLUMN_HELP = {
  name: 'Label on the submit form',
  description: 'What submitters should enter',
  type: 'Kind of value',
  indexed: `Searchable, max ${MAX_IDENTIFIERS}`,
}

const Editor = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const HeaderRow = styled.div`
  display: grid;
  grid-template-columns: ${COLUMNS};
  gap: 12px;
  padding: 0 12px 4px;

  > span {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  @media (max-width: 900px) {
    display: none;
  }
`

const FieldRow = styled.div`
  display: grid;
  grid-template-columns: ${COLUMNS};
  align-items: start;
  gap: 12px;
  padding: 12px;
  border: 1px solid transparent;
  border-radius: var(--radius);
  background: var(--color-raised);
  transition:
    border-color var(--motion),
    transform var(--motion);
  ${reveal}

  &:hover,
  &:focus-within {
    border-color: var(--glass-border);
  }

  @media (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 14px;
    padding: 14px;
  }
`

const Index = styled.span`
  display: inline-flex;
  align-items: center;
  height: 44px;
  color: var(--color-faint);
  font-family: var(--font-figure);
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;

  @media (max-width: 900px) {
    height: auto;
  }
`

const Cell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;

  @media (max-width: 900px) {
    grid-column: 1 / -1;
  }
`

const CellLabel = styled.label`
  display: none;
  flex-direction: column;
  gap: 2px;

  @media (max-width: 900px) {
    display: flex;
  }
`

const RemoveSlot = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 44px;

  @media (max-width: 900px) {
    grid-row: 1;
    grid-column: 2;
    height: auto;
  }
`

const ToggleCell = styled.div`
  display: flex;
  align-items: center;
  height: 44px;

  @media (max-width: 900px) {
    grid-column: 1 / -1;
    height: auto;
  }
`

const FileTypes = styled.div`
  grid-column: 2 / 5;

  @media (max-width: 900px) {
    grid-column: 1 / -1;
  }
`

const ToggleLabel = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;

  /* The visible name, phones only (the switch's own parts are not direct children). */
  > span {
    display: none;
    color: var(--color-text);
    font-size: var(--fs-body);
    font-weight: 500;
  }

  @media (max-width: 900px) {
    > span {
      display: inline;
    }
  }
`

/** A text input bound to one column property, labelled for screen readers. */
const ColumnInput = ({
  name,
  label,
  help,
  placeholder,
}: {
  name: string
  label: string
  help: string
  placeholder?: string
}) => {
  const id = useId()
  const [field, meta] = useField<string | undefined>(name)
  const invalid = !!meta.touched && !!meta.error
  return (
    <Cell>
      <CellLabel htmlFor={id}>
        <Label $tone="muted">{label}</Label>
        <Small $muted>{help}</Small>
      </CellLabel>
      <Input
        id={id}
        name={field.name}
        value={field.value ?? ''}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        autoComplete="off"
        onChange={field.onChange}
        onBlur={field.onBlur}
      />
      {invalid && <ErrorText id={`${id}-error`}>{meta.error}</ErrorText>}
    </Cell>
  )
}

type ItemFormValues = TcrState
type ItemParamsOuterProps = StepProps
type ItemParamsProps = ItemParamsOuterProps & FormikProps<ItemFormValues>

const ItemParams = ({
  handleSubmit,
  setFieldValue,
  formId,
  values: { columns, isTCRofTCRs },
  status,
  setTcrState,
}: ItemParamsProps) => {
  const ids = useId()

  const toggleTCRofTCRs = useCallback(() => {
    if (!isTCRofTCRs) {
      setFieldValue(`columns`, [
        {
          label: 'Address',
          description: 'The list address.',
          type: GTCR_ADDRESS,
          isIdentifier: true,
        },
      ])
      setFieldValue(`isTCRofTCRs`, true)
    } else setFieldValue(`isTCRofTCRs`, false)
  }, [isTCRofTCRs, setFieldValue])

  useEffect(() => {
    setTcrState((previousState) => ({
      ...previousState,
      isTCRofTCRs,
      columns,
    }))
  }, [columns, isTCRofTCRs, setTcrState])

  const onTypeChange = (index: number, value: string) => {
    setFieldValue(`columns[${index}].type`, value)
    // Long text and image fields cannot be identifiers.
    if (value === LONG_TEXT || value === IMAGE)
      setFieldValue(`columns[${index}].isIdentifier`, false)
  }

  const identifierCount = columns.filter((column) => column.isIdentifier).length
  const problem = typeof status === 'string' ? status : ''

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate>
      <StepBody>
        <StepHeader
          heading="Define the entry fields"
          lede="Each field is a column of the list, shown in this order: put the image or the title first."
        />

        <SwitchField
          id={`${ids}-list-of-lists`}
          label="This is a list of lists"
          help="Entries are other lists: one field, the list address; title and logo come from each list."
          checked={!!isTCRofTCRs}
          onChange={toggleTCRofTCRs}
        />

        {!isTCRofTCRs && (
          <FieldArray name="columns">
            {({ push, remove }) => (
              <Editor role="group" aria-label="Entry fields">
                <HeaderRow aria-hidden>
                  <span />
                  <span>
                    <Label $tone="faint">Name</Label>
                    <Small $faint>{COLUMN_HELP.name}</Small>
                  </span>
                  <span>
                    <Label $tone="faint">Description</Label>
                    <Small $faint>{COLUMN_HELP.description}</Small>
                  </span>
                  <span>
                    <Label $tone="faint">Type</Label>
                    <Small $faint>{COLUMN_HELP.type}</Small>
                  </span>
                  <span>
                    <Label $tone="faint">Indexed</Label>
                    <Small $faint>{COLUMN_HELP.indexed}</Small>
                  </span>
                  <span />
                </HeaderRow>
                {columns.map((column, index) => {
                  const canBeIdentifier =
                    (identifierCount < MAX_IDENTIFIERS ||
                      !!column.isIdentifier) &&
                    column.type !== LONG_TEXT &&
                    column.type !== IMAGE &&
                    column.type !== FILE
                  const typeId = `${ids}-type-${index}`
                  const indexedId = `${ids}-indexed-${index}`
                  return (
                    <FieldRow
                      key={index}
                      role="group"
                      aria-label={`Field ${index + 1}`}
                      style={{ ['--i' as string]: Math.min(index, 6) }}
                    >
                      <Index aria-hidden>
                        {String(index + 1).padStart(2, '0')}
                      </Index>
                      <ColumnInput
                        name={`columns[${index}].label`}
                        label="Name"
                        help={COLUMN_HELP.name}
                        placeholder="Name"
                      />
                      <ColumnInput
                        name={`columns[${index}].description`}
                        label="Description"
                        help={COLUMN_HELP.description}
                        placeholder="What to enter"
                      />
                      <Cell>
                        <CellLabel htmlFor={typeId}>
                          <Label $tone="muted">Type</Label>
                          <Small $muted>{COLUMN_HELP.type}</Small>
                        </CellLabel>
                        <Select
                          id={typeId}
                          aria-label={`Field ${index + 1} type`}
                          value={String(column.type)}
                          onChange={(value) => onTypeChange(index, value)}
                          options={TYPE_OPTIONS}
                          menuMinWidth={180}
                        />
                      </Cell>
                      <ToggleCell>
                        <ToggleLabel
                          htmlFor={indexedId}
                          title={
                            canBeIdentifier
                              ? `Searchable and shown on the entry card; up to ${MAX_IDENTIFIERS} fields.`
                              : 'Long text, image and file fields cannot be indexed.'
                          }
                        >
                          <Switch
                            id={indexedId}
                            aria-label={`Field ${index + 1} indexed`}
                            checked={!!column.isIdentifier}
                            disabled={!canBeIdentifier}
                            onChange={(checked) =>
                              setFieldValue(
                                `columns[${index}].isIdentifier`,
                                checked,
                              )
                            }
                          />
                          <span>Indexed</span>
                        </ToggleLabel>
                      </ToggleCell>
                      <RemoveSlot>
                        {columns.length > 1 && (
                          <IconButton
                            type="button"
                            aria-label={`Remove field ${index + 1}`}
                            onClick={() => remove(index)}
                          >
                            <CurateIcon name="remove" size={16} />
                          </IconButton>
                        )}
                      </RemoveSlot>
                      {column.type === FILE && (
                        <FileTypes>
                          <TextField
                            name={`columns[${index}].allowedFileTypes`}
                            label="Allowed file types"
                            placeholder="pdf doc mp3"
                            help="Extensions separated by spaces."
                          />
                        </FileTypes>
                      )}
                    </FieldRow>
                  )
                })}
                <Stack $gap={10} style={{ marginTop: 8 }}>
                  <div>
                    <Button
                      type="button"
                      $variant="secondary"
                      $size="sm"
                      onClick={() =>
                        push({ label: '', description: '', type: 'address' })
                      }
                    >
                      Add a field
                    </Button>
                  </div>
                  {problem && <ErrorText role="alert">{problem}</ErrorText>}
                </Stack>
              </Editor>
            )}
          </FieldArray>
        )}
      </StepBody>
    </form>
  )
}

export default withFormik<ItemParamsOuterProps, ItemFormValues>({
  validationSchema: itemSchema,
  mapPropsToValues: ({ tcrState }) => tcrState,
  handleSubmit: (
    { columns, isTCRofTCRs },
    { props: { postSubmit }, setStatus },
  ) => {
    const problem = isTCRofTCRs ? null : itemColumnsProblem(columns)
    if (problem) {
      toast.warning(problem)
      setStatus(problem)
      return
    }
    setStatus(undefined)
    postSubmit()
  },
})(ItemParams)
