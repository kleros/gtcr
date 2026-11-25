import React, { useEffect, useCallback, useId } from 'react'
import { toast } from 'react-toastify'
import { withFormik, type FormikProps } from 'formik'
import { ItemTypes } from '@kleros/gtcr-encoder'
import { useFailedSubmitFocus } from 'components/curate/v2-factory-shell'
import {
  StepBody,
  StepHeader,
  SwitchField,
} from 'components/curate/factory-shared-fields'
import { ColumnsEditor } from 'components/curate/factory-shared-columns'
import { itemColumnsProblem, itemSchema } from './schemas'
import type { StepProps, TcrState } from '.'

/*
 * Step 2, the item: the fields every entry has (the shared fields editor)
 * and the list-of-lists switch. The two submit checks (one identifier,
 * unique names) are the ones the previous step had.
 */

type ItemFormValues = TcrState
type ItemParamsOuterProps = StepProps
type ItemParamsProps = ItemParamsOuterProps & FormikProps<ItemFormValues>

const ItemParams = ({
  handleSubmit,
  setFieldValue,
  formId,
  values: { columns, isTCRofTCRs },
  errors,
  submitCount,
  isSubmitting,
  status,
  setTcrState,
}: ItemParamsProps) => {
  const ids = useId()
  useFailedSubmitFocus({ formId, submitCount, isSubmitting, errors })

  const toggleTCRofTCRs = useCallback(() => {
    if (!isTCRofTCRs) {
      setFieldValue(`columns`, [
        {
          label: 'Address',
          description: 'The list address.',
          type: ItemTypes.GTCR_ADDRESS,
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
          <ColumnsEditor
            columns={columns}
            setFieldValue={setFieldValue}
            problem={problem}
          />
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
