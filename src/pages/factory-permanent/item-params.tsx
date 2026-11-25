import React, { useEffect } from 'react'
import { toast } from 'react-toastify'
import { withFormik, type FormikProps } from 'formik'
import { useFailedSubmitFocus } from 'components/curate/v2-factory-shell'
import { StepBody, StepHeader } from 'components/curate/factory-shared-fields'
import {
  ColumnsEditor,
  MAX_IDENTIFIERS,
} from 'components/curate/factory-shared-columns'
import { itemColumnsProblem, itemSchema } from './schemas'
import type { StepProps, TcrState } from '.'

/*
 * The item step of the Stake factory: the fields every entry has (the
 * shared fields editor). The two checks on Next (one identifier, unique
 * names) are unchanged.
 */

type ItemFormValues = TcrState
type ItemParamsOuterProps = StepProps
type ItemParamsProps = ItemParamsOuterProps & FormikProps<ItemFormValues>

const ItemParams = ({
  handleSubmit,
  setFieldValue,
  formId,
  values: { columns },
  errors,
  submitCount,
  isSubmitting,
  status,
  setTcrState,
}: ItemParamsProps) => {
  useFailedSubmitFocus({ formId, submitCount, isSubmitting, errors })

  useEffect(() => {
    setTcrState((previousState) => ({
      ...previousState,
      columns,
    }))
  }, [columns, setTcrState])

  const problem = typeof status === 'string' ? status : ''

  return (
    <form id={formId} noValidate onSubmit={handleSubmit}>
      <StepBody>
        <StepHeader
          heading="Define the entry fields"
          lede={`Entries show their fields in this order: put the image or the title first. Identifier fields are searchable and shown on the entry card; at least one, up to ${MAX_IDENTIFIERS}.`}
        />
        <ColumnsEditor
          columns={columns}
          setFieldValue={setFieldValue}
          problem={problem}
        />
      </StepBody>
    </form>
  )
}

export default withFormik<ItemParamsOuterProps, ItemFormValues>({
  validationSchema: itemSchema,
  mapPropsToValues: ({ tcrState }) => tcrState,
  handleSubmit: ({ columns }, { props: { postSubmit }, setStatus }) => {
    const problem = itemColumnsProblem(columns)
    if (problem) {
      toast.warning(problem)
      setStatus(problem)
      return
    }
    setStatus(undefined)
    postSubmit()
  },
})(ItemParams)
