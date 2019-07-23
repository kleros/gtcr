import { Card, Button, Row, Col, Icon, Select, Form, Divider } from 'antd'
import { withFormik, FieldArray, Field } from 'formik'
import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import * as yup from 'yup'
import CustomInput from './custom-input'
import ItemPreview from './item-preview'

const ItemParams = ({
  handleSubmit,
  setFieldValue,
  formId,
  values: { columns },
  errors,
  touched,
  ...rest
}) => {
  const { setTcrState } = rest

  useEffect(() => {
    setTcrState(previousState => ({
      ...previousState,
      columns
    }))
  }, [columns, setTcrState])

  return (
    <Card title="Choose the item columns">
      <Row
        gutter={{ xs: 4, sm: 8, md: 12 }}
        type="flex"
        justify="space-between"
      >
        <Col span={5}>Name</Col>
        <Col span={10}>Description</Col>
        <Col span={6}>Type</Col>
        {columns.length > 1 && <Col span={1} />}
      </Row>
      <form id={formId} onSubmit={handleSubmit}>
        <FieldArray name="columns">
          {({ push, remove }) => (
            <>
              {columns &&
                columns.length > 0 &&
                columns.map((_, index) => (
                  <Row
                    gutter={{ xs: 4, sm: 8, md: 12 }}
                    key={index}
                    type="flex"
                    justify="space-between"
                  >
                    <Col span={5}>
                      <CustomInput
                        name={`columns[${index}].label`}
                        placeholder="Token Name"
                        hasFeedback
                        touched={
                          touched.columns &&
                          touched.columns[index] &&
                          touched.columns[index].label
                        }
                        error={
                          errors.columns &&
                          errors.columns[index] &&
                          errors.columns[index].label
                        }
                        {...rest}
                      />
                    </Col>
                    <Col span={10}>
                      <CustomInput
                        name={`columns[${index}].description`}
                        placeholder="The commonly used token name."
                        hasFeedback
                        touched={
                          touched.columns &&
                          touched.columns[index] &&
                          touched.columns[index].description
                        }
                        error={
                          errors.columns &&
                          errors.columns[index] &&
                          errors.columns[index].description
                        }
                        {...rest}
                      />
                    </Col>
                    <Col span={6}>
                      <Field name={`columns[${index}].type`}>
                        {({ field }) => (
                          <Form.Item>
                            <Select
                              {...field}
                              value={columns[index].type}
                              onChange={value =>
                                setFieldValue(`columns[${index}].type`, value)
                              }
                            >
                              <Select.Option value="address">
                                address
                              </Select.Option>
                              <Select.Option value="number">
                                number
                              </Select.Option>
                              <Select.Option value="boolean">
                                boolean
                              </Select.Option>
                            </Select>
                          </Form.Item>
                        )}
                      </Field>
                    </Col>
                    {columns.length > 1 && (
                      <Col span={1}>
                        <Form.Item>
                          <Icon
                            className="dynamic-delete-button"
                            type="minus-circle-o"
                            onClick={() => remove(index)}
                          />
                        </Form.Item>
                      </Col>
                    )}
                  </Row>
                ))}
              <Button
                onClick={() =>
                  push({ label: '', description: '', type: 'address' })
                }
              >
                Add Field
              </Button>
            </>
          )}
        </FieldArray>
        <Divider />
        <ItemPreview columns={columns} />
      </form>
    </Card>
  )
}

const validationSchema = yup.object().shape({
  columns: yup.array().of(
    yup.object().shape({
      label: yup.string().required('The column label is required.'),
      description: yup.string().required('The column description is required.')
    })
  )
})

ItemParams.propTypes = {
  handleSubmit: PropTypes.func.isRequired,
  setFieldValue: PropTypes.func.isRequired,
  formId: PropTypes.string.isRequired,
  errors: PropTypes.shape({
    columns: PropTypes.arrayOf(PropTypes.objectOf(PropTypes.string))
  }).isRequired,
  touched: PropTypes.shape({
    columns: PropTypes.arrayOf(PropTypes.objectOf(PropTypes.bool))
  }).isRequired,
  values: PropTypes.shape({
    challengeDeposit: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
      .isRequired,
    description: PropTypes.string.isRequired,
    requestDeposit: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
      .isRequired,
    requireEvidenceRequest: PropTypes.bool.isRequired,
    title: PropTypes.string.isRequired,
    columns: PropTypes.arrayOf(
      PropTypes.shape({
        description: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        type: PropTypes.string.isRequired
      })
    ).isRequired
  }).isRequired
}

export default withFormik({
  validationSchema,
  mapPropsToValues: ({ tcrState }) => tcrState,
  handleSubmit: (_, { props: { postSubmit } }) => {
    postSubmit()
  }
})(ItemParams)
