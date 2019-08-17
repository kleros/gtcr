import { Card, Icon, Tooltip, Form, Switch } from 'antd'
import { withFormik, Field } from 'formik'
import PropTypes from 'prop-types'
import React, { useEffect } from 'react'
import * as yup from 'yup'
import CustomInput from '../../components/custom-input'

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
          name="arbitratorAddress"
          placeholder="0x7331deadbeef..."
          hasFeedback
          error={errors.arbitratorAddress}
          touched={touched.arbitratorAddress}
          label={
            <span>
              Arbitrator&nbsp;
              <Tooltip title="The address of the arbitrator to use for this TCR.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          {...rest}
        />
        <CustomInput
          name="itemName"
          placeholder="Token"
          hasFeedback
          error={errors.itemName}
          touched={touched.itemName}
          label={
            <span>
              Item Name&nbsp;
              <Tooltip
                title={`What is the item? This will replace the word "item" in the TCR interface. Examples.: Ad (for a TCR of ads), Movie (for a TCR of movies)`}
              >
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          {...rest}
        />
        <CustomInput
          name="requesterBaseDeposit"
          placeholder="0.1 ETH"
          addonAfter="ETH"
          error={errors.requesterBaseDeposit}
          touched={touched.requesterBaseDeposit}
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
          name="challengerBaseDeposit"
          placeholder="0.05 ETH"
          addonAfter="ETH"
          error={errors.challengerBaseDeposit}
          touched={touched.challengerBaseDeposit}
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
            <FormItem
              label="Require evidence on request"
              style={{ marginBottom: '12px', display: 'flex' }}
            >
              <Switch
                onChange={value =>
                  setFieldValue('requireEvidenceRequest', value)
                }
                style={{ marginLeft: '8px' }}
                checked={field.value}
              />
            </FormItem>
          )}
        </Field>
        {/* Let the user mark if this is a TCR of TCRs. */}
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
  title: yup
    .string()
    .required('A title is required.')
    .max(30, 'Title must be less than 60 characters long.'),
  description: yup
    .string()
    .required('A description is required.')
    .max(255, 'Description must be less than 255 characters long.'),
  arbitratorAddress: yup
    .string()
    .required('An arbitrator address is required.')
    .max(160, 'Ethereum addresses are 42 characters long.'),
  itemName: yup
    .string()
    .required('An item name is required.')
    .max(60, 'The item name must be less than 20 characters long.'),
  requesterBaseDeposit: yup
    .number()
    .typeError('Amount should be a number.')
    .required('A value is required.')
    .min(0, 'The amount must not be negative.'),
  challengerBaseDeposit: yup
    .number()
    .typeError('Amount should be a number.')
    .required('A value is required.')
    .min(0, 'The amount must not be negative.')
})

export default withFormik({
  validationSchema,
  mapPropsToValues: ({ tcrState }) => {
    const values = { ...tcrState }
    delete values.transactions
    return values
  },
  handleSubmit: (_, { props: { postSubmit } }) => {
    postSubmit()
  }
})(TCRParams)
