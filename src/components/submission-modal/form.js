import React from 'react'
import { withFormik, Field } from 'formik'
import { Button, Form, Input, Tooltip, Icon, Switch } from 'antd'
import styled from 'styled-components/macro'
import PropTypes from 'prop-types'
import itemTypes, { typeDefaultValues } from '../../utils/item-types'
import CustomInput from '../custom-input'

const InputSelector = ({ type, setFieldValue, ...props }) => {
  const { name, label } = props
  switch (type) {
    case itemTypes.TEXT:
    case itemTypes.ADDRESS:
    case itemTypes.NUMBER:
      return <CustomInput {...props} />
    case itemTypes.BOOLEAN:
      return (
        <Field name={name}>
          {({ field }) => (
            <Form.Item label={label} style={{ display: 'flex' }}>
              <Switch
                {...field}
                onChange={value => setFieldValue(name, value)}
              />
            </Form.Item>
          )}
        </Field>
      )
    case itemTypes.LONGTEXT:
      return (
        <Field name={name}>
          {({ field }) => (
            <Form.Item label={label}>
              <Input.TextArea autosize={{ minRows: 2 }} {...field} />
            </Form.Item>
          )}
        </Field>
      )
    default:
      throw new Error('Unhandled input type', type)
  }
}

const StyledModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
`

const SubmissionForm = ({ columns, handleSubmit, onCancel, setFieldValue }) => (
  <Form onSubmit={handleSubmit}>
    {columns &&
      columns.length > 0 &&
      columns.map((column, index) => (
        <InputSelector
          type={column.type}
          name={column.label}
          key={index}
          label={
            <span>
              {column.label}&nbsp;
              <Tooltip title={column.description}>
                <Icon type="question-circle-o" />
              </Tooltip>
            </span>
          }
          setFieldValue={setFieldValue}
        />
      ))}
    <StyledModalFooter>
      <Button key="back" onClick={onCancel}>
        Cancel
      </Button>
      <Button
        key="submit"
        type="primary"
        htmlType="submit"
        style={{ marginLeft: '8px' }}
      >
        Submit
      </Button>
    </StyledModalFooter>
  </Form>
)

SubmissionForm.propTypes = {
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired
    })
  ).isRequired,
  onCancel: PropTypes.func.isRequired,
  setFieldValue: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired
}

export default withFormik({
  mapPropsToValues: ({ columns }) =>
    columns.reduce(
      (acc, curr) => ({
        ...acc,
        [curr.label]: typeDefaultValues[curr.type]
      }),
      {}
    ),
  handleSubmit: (values, { props: { postSubmit, columns } }) => {
    postSubmit(values, columns)
  }
})(SubmissionForm)
