import { Card, Button, Row, Col, Icon, Select, Form } from 'antd'
import { withFormik, FieldArray, Field } from 'formik'
import React from 'react'
import * as yup from 'yup'

import CustomInput from './custom-input'
const FormItem = Form.Item
const { Option } = Select

const ItemParams = ({
  handleSubmit,
  setFieldValue,
  formId,
  values: { columns },
  errors,
  touched,
  ...rest
}) => {
  return (
    <Card title='Choose the item columns'>
      <form id={formId} onSubmit={handleSubmit}>
        <FieldArray name='columns'>
          {({ push, remove }) => (
            <>
              {columns && columns.length > 0 && columns.map((_, index) => (
                <Row gutter={{ xs: 8, sm: 16, md: 24 }} key={index} type='flex' justify='space-between'>
                  <Col span={8}>
                    <CustomInput
                      name={`columns[${index}].label`}
                      placeholder='Name'
                      hasFeedback
                      touched={touched.columns && touched.columns[index] && touched.columns[index].label}
                      error={errors.columns && errors.columns[index] && errors.columns[index].label}
                      {...rest}
                    />
                  </Col>
                  <Col span={7}>
                    <CustomInput
                      name={`columns[${index}].description`}
                      placeholder='Description'
                      hasFeedback
                      touched={touched.columns && touched.columns[index] && touched.columns[index].description}
                      error={errors.columns && errors.columns[index] && errors.columns[index].description}
                      {...rest}
                    />
                  </Col>
                  <Col span={8}>
                    <Field name={`columns[${index}].type`}>
                      {({ field }) => (
                        <FormItem>
                          <Select {...field} value={columns[index].type} onChange={value => setFieldValue(`columns[${index}].type`, value)}>
                            <Option value='address'>address</Option>
                            <Option value='number'>number</Option>
                            <Option value='boolean'>boolean</Option>
                          </Select>
                        </FormItem>
                      )}
                    </Field>
                  </Col>
                  {columns.length > 1 && (
                    <Col span={1}>
                      <Icon className='dynamic-delete-button' type='minus-circle-o' onClick={() => remove(index)} />
                    </Col>
                  )}
                </Row>
              ))}
              <Button onClick={() => push({ label: '', description: '', type: 'address' })}>Add Field</Button>
            </>
          )}
        </FieldArray>
      </form>
    </Card>
  )
}

const validationSchema = yup.object().shape({
  columns: yup.array().of(yup.object().shape({
    label: yup.string().required('The column label is required.'),
    description: yup.string().required('The column description is required.')
  }))
})

export default withFormik({
  validationSchema,
  mapPropsToValues: ({ tcrState }) => ({
    columns: [
      {
        label: '',
        description: '',
        type: 'address'
      }
    ],
    ...tcrState
  }),
  handleSubmit: ({ columns }, { props: { postSubmit, tcrState } }) => {
    postSubmit({
      ...tcrState,
      columns
    })
  }
})(ItemParams)
