import { Card, Icon, Tooltip, Form, Switch } from 'antd'
import { withFormik, Field } from 'formik'
import PropTypes from 'prop-types'
import React, { useEffect } from 'react'
import * as yup from 'yup'
import CustomInput from './custom-input'

const FormItem = Form.Item

const TCRParams = ({
  handleSubmit,
  formId,
  errors,
  setFieldValue,
  touched,
  ...rest
}) => {
  const { values, setTcrState } = rest

  useEffect(() => {
    setTcrState(previousState => ({
      ...previousState,
      ...values
    }))
  }, [values, setTcrState])

  return (
    <Card title="Choose the item columns and identifiers">
      <Form layout="vertical" id={formId} onSubmit={handleSubmit}>
        <CustomInput
          name="title"
          placeholder="Token² Curated List"
          label={<span>Title</span>}
          error={errors.title}
          touched={touched.title}
          hasFeedback
          {...rest}
        />
        <CustomInput
          name="description"
          placeholder="A token curated list of tokens powered by Kleros..."
          hasFeedback
          error={errors.description}
          touched={touched.description}
          label={
            <span>
              Description&nbsp;
              <Tooltip title="A short sentence describing the what are the the TCR items and its listing criteria.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          {...rest}
        />
        <CustomInput
          name="requestDeposit"
          placeholder="0.1 ETH"
          addonAfter="ETH"
          error={errors.requestDeposit}
          touched={touched.requestDeposit}
          label={
            <span>
              Registration Deposit&nbsp;
              <Tooltip title="This will be the deposit required to submit or remove an item.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          {...rest}
        />
        <CustomInput
          name="challengeDeposit"
          placeholder="0.05 ETH"
          addonAfter="ETH"
          error={errors.challengeDeposit}
          touched={touched.challengeDeposit}
          label={
            <span>
              Challenger Deposit&nbsp;
              <Tooltip title="This is the deposit required to challenge a submission or removal request.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          {...rest}
        />
        <Field name="requireEvidenceRequest">
          {({ field }) => (
            <FormItem label="Require evidence on request">
              <Switch
                onChange={value =>
                  setFieldValue('requireEvidenceRequest', value)
                }
                checked={field.value}
              />
            </FormItem>
          )}
        </Field>
      </Form>
    </Card>
  )
}

TCRParams.propTypes = {
  handleSubmit: PropTypes.func.isRequired,
  setFieldValue: PropTypes.func.isRequired,
  formId: PropTypes.string.isRequired,
  errors: PropTypes.objectOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(PropTypes.objectOf(PropTypes.string))
    ])
  ).isRequired,
  touched: PropTypes.objectOf(
    PropTypes.oneOfType([
      PropTypes.bool,
      PropTypes.arrayOf(PropTypes.objectOf(PropTypes.bool))
    ])
  ).isRequired
}

const validationSchema = yup.object().shape({
  title: yup.string().max(60, 'Title must be less than 60 characters long.'),
  description: yup
    .string()
    .max(255, 'Description must be less than 255 characters long.'),
  requestDeposit: yup
    .number()
    .typeError('Amount should be a number')
    .required('A value is required')
    .min(0, 'The amount must not be negative'),
  challengeDeposit: yup
    .number()
    .typeError('Amount should be a number')
    .required('A value is required')
    .min(0, 'The amount must not be negative')
})

export default withFormik({
  validationSchema,
  mapPropsToValues: ({ tcrState }) => tcrState,
  handleSubmit: (_, { props: { postSubmit } }) => {
    postSubmit()
  }
})(TCRParams)
