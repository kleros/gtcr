import { Card, Form, Icon, Input, Tooltip } from 'antd'
import { withFormik } from 'formik'
import React from 'react'
import * as yup from 'yup'

const FormItem = Form.Item

const TCRParamsForm = ({
  values: { title, description, requestDeposit, challengeDeposit },
  touched,
  errors,
  handleChange,
  handleBlur,
  handleSubmit,
  formId
}) => {
  return (
    <Card title="Choose the item columns and identifiers">
      <form id={formId} onSubmit={handleSubmit}>
        <FormItem
          label={<span>Title</span>}
          validateStatus={errors.title && touched.title ? 'error' : undefined}
          help={errors.title && touched.title ? errors.title : ''}
          hasFeedback
        >
          <Input name="title" placeholder="Token² Curated List" onChange={handleChange} value={title} onBlur={handleBlur}/>
        </FormItem>
        <FormItem
          label={
            <span>
              Description&nbsp;
              <Tooltip title="A short sentence describing the what are the the TCR items and its listing criteria.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          validateStatus={errors.description && touched.description ? 'error' : undefined}
          help={errors.description && touched.description ? errors.description : ''}
          hasFeedback
        >
          <Input
            name="description"
            placeholder="A token curated list of tokens powered by Kleros..."
            onChange={handleChange}
            value={description}
            onBlur={handleBlur}
          />
        </FormItem>
        <FormItem
          label={
            <span>
              Registration Deposit&nbsp;
              <Tooltip title="This will be the deposit required to submit or remove an item.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          validateStatus={errors.requestDeposit && touched.requestDeposit ? 'error' : undefined}
          help={errors.requestDeposit && touched.requestDeposit ? errors.requestDeposit : ''}
          hasFeedback
        >
          <Input
            name="requestDeposit"
            addonBefore="ETH"
            placeholder="0.1 ETH"
            onChange={handleChange}
            value={requestDeposit}
            onBlur={handleBlur}
          />
        </FormItem>
        <FormItem
          label={
            <span>
              Challenger Deposit&nbsp;
              <Tooltip title="This is the deposit required to challenge a submission or removal request.">
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          validateStatus={errors.challengeDeposit && touched.challengeDeposit ? 'error' : undefined}
          help={touched.challengeDeposit && errors.challengeDeposit ? errors.challengeDeposit : ''}
          hasFeedback
        >
          <Input
            name="challengeDeposit"
            addonBefore="ETH"
            placeholder="0.05 ETH"
            onChange={handleChange}
            value={challengeDeposit}
            onBlur={handleBlur}
          />
        </FormItem>
      </form>
    </Card>
  )
}

const validationSchema = yup.object().shape({
  title: yup.string().max(60, 'Title must be less than 60 characters long.'),
  description: yup.string().max(255, 'Description must be less than 255 characters long.'),
  requestDeposit: yup.number().typeError('Amount should be a number').required('A value is required').min(0,'The amount must not be negative'),
  challengeDeposit: yup.number().typeError('Amount should be a number').required('A value is required').min(0,'The amount must not be negative')
})

export default withFormik({
  validationSchema,
  mapPropsToValues: () => ({
    requestDeposit: 0.1,
    challengeDeposit: 0.05
  }),
  handleSubmit: async ({ props: { postSubmit }}) => {
    postSubmit()
  }
})(TCRParamsForm)
