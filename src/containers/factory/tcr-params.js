import { Card, Form, Icon, Input, Tooltip } from 'antd'
import { withFormik } from 'formik'
import React from 'react'

const FormItem = Form.Item

const TCRParamsForm = ({
  values: { title, description, requestDeposit, challengeDeposit },
  touched,
  errors,
  handleChange,
  handleBlur,
  handleSubmit,
  formId,
  postSubmit
}) => {
  return (
    <Card title="Choose the item columns and identifiers">
      <form id={formId} onSubmit={handleSubmit}>
        <FormItem label={<span>Title</span>}>
          <Input name="title" placeholder="Token² Curated List" onChange={handleChange} value={title} />
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
        >
          <Input
            name="description"
            placeholder="A token curated list of tokens powered by Kleros..."
            onChange={handleChange}
            value={description}
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
        >
          <Input name="requestDeposit" addonBefore="ETH" placeholder="0.1 ETH" onChange={handleChange} value={requestDeposit}/>
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
        >
          <Input name="challengeDeposit" addonBefore="ETH" placeholder="0.05 ETH" onChange={handleChange} value={challengeDeposit}/>
        </FormItem>
      </form>
    </Card>
  )
}

export default withFormik({
  mapPropsToValues: () => ({
    requestDeposit: 0.1,
    challengeDeposit: 0.05
  }),
  handleSubmit: async (values, {props: { postSubmit }, setErrors}) => {
    console.info(values)
    postSubmit()
  }
})(TCRParamsForm)
