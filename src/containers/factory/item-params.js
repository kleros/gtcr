import { Card, Button, Row, Col, Icon } from 'antd'
import { withFormik, FieldArray } from 'formik'
import React from 'react'
import * as yup from 'yup'

import CustomInput from './custom-input'

const ItemParams = ({
  handleSubmit,
  formId,
  values: { columns },
  errors,
  touched,
  ...rest
}) => {
  return (
    <Card title="Choose the item columns">
      <form id={formId} onSubmit={handleSubmit}>
        <FieldArray name="columns">
          {({ push, remove }) => (
            <>
              {columns && columns.length > 0 && columns.map((_, index) => (
                <Row gutter={16} key={index} type="flex" justify="start">
                  <Col span={8}>
                    <CustomInput
                      name={`columns[${index}].label`}
                      placeholder="Name"
                      hasFeedback
                      touched={touched.columns && touched.columns[index] && touched.columns[index].label}
                      error={errors.columns && errors.columns[index] && errors.columns[index].label}
                      {...rest}
                    />
                  </Col>
                  <Col span={8}>
                    <CustomInput
                      name={`columns[${index}].description`}
                      placeholder="Description"
                      hasFeedback
                      touched={touched.columns && touched.columns[index] && touched.columns[index].description}
                      error={errors.columns && errors.columns[index] && errors.columns[index].description}
                      {...rest}
                    />
                  </Col>
                  <Col span={7}>
                    <CustomInput
                      name={`columns[${index}].type`}
                      placeholder="Type"
                      hasFeedback
                      touched={touched.columns && touched.columns[index] && touched.columns[index].type}
                      error={errors.columns && errors.columns[index] && errors.columns[index].type}
                      {...rest}
                    />
                  </Col>
                  <Col span={1}><Icon className="dynamic-delete-button" type="minus-circle-o" onClick={() => remove(index)}/></Col>
                </Row>
              ))}
              <Button onClick={() => push({ label: '', description: '' })}>Add Field</Button>
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
    description: yup.string().required('The column description is required.'),
    type: yup.string().required('The column type is required.'),
  }))
})

export default withFormik({
  validationSchema,
  mapPropsToValues: () => ({
    columns: [
      {
        label: '',
        description: ''
      }
    ]
  }),
  handleSubmit: (_, { props: { postSubmit }}) => {
    postSubmit()
  }
})(ItemParams)
