import {
  Card,
  Button,
  Row,
  Col,
  Icon,
  Select,
  Form,
  Divider,
  Switch,
  Tooltip
} from 'antd'
import { withFormik, FieldArray, Field } from 'formik'
import React, { useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import * as yup from 'yup'
import CustomInput from '../../components/custom-input'
import ItemDetailsCard from '../../components/item-details-card'
import itemTypes from '../../utils/item-types'
import { STATUS_CODE } from '../../utils/item-status'

const { LONGTEXT, IMAGE } = itemTypes

const ItemParams = ({
  handleSubmit,
  setFieldValue,
  formId,
  values: { columns, isTCRofTCRs },
  errors,
  touched,
  ...rest
}) => {
  const { setTcrState } = rest
  const toggleTCRofTCRs = useCallback(() => {
    if (!isTCRofTCRs) {
      setFieldValue(`columns`, [
        {
          label: 'Address',
          description: 'The TCR address.',
          type: 'GTCR address',
          isIdentifier: true
        }
      ])
      setFieldValue(`isTCRofTCRs`, true)
    } else setFieldValue(`isTCRofTCRs`, false)
  }, [isTCRofTCRs, setFieldValue])

  useEffect(() => {
    setTcrState(previousState => ({
      ...previousState,
      isTCRofTCRs,
      columns
    }))
  }, [columns, isTCRofTCRs, setTcrState])

  const onTypeChange = (index, value) => {
    setFieldValue(`columns[${index}].type`, value)
    if (value === LONGTEXT)
      // Long text fields cannot be identifiers.
      setFieldValue(`columns[${index}].isIdentifier`, false)
    if (value === IMAGE)
      // Image fields cannot be identifiers.
      setFieldValue(`columns[${index}].isIdentifier`, false)
  }

  return (
    <Card title="Choose the item columns">
      <Row>
        <Col span={24}>
          Is this a TCR of TCRs?
          <Tooltip title="A TCR of TCRs has only one column: the TCR address. Information such as its title, description and logo will be pulled from the TCR.">
            &nbsp;
            <Icon type="question-circle-o" />
          </Tooltip>
          {'  '}
          <Switch checked={isTCRofTCRs} onChange={toggleTCRofTCRs} />
        </Col>
      </Row>
      <Divider />
      {!isTCRofTCRs && (
        <Row
          gutter={{ xs: 4, sm: 8, md: 12 }}
          type="flex"
          justify="space-between"
        >
          <Col span={5}>Name</Col>
          <Col span={8}>Description</Col>
          <Col span={6}>Type</Col>
          <Col span={2}>
            ID
            <Tooltip title="Whether to display this field on the list of items.">
              &nbsp;
              <Icon type="question-circle-o" />
            </Tooltip>
          </Col>
          {columns.length > 1 && <Col span={1} />}
        </Row>
      )}
      <form id={formId} onSubmit={handleSubmit}>
        {!isTCRofTCRs && (
          <>
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
                        <Col span={8}>
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
                                  onChange={value => onTypeChange(index, value)}
                                >
                                  {Object.values(itemTypes).map(
                                    (itemType, i) => (
                                      <Select.Option value={itemType} key={i}>
                                        {itemType}
                                      </Select.Option>
                                    )
                                  )}
                                </Select>
                              </Form.Item>
                            )}
                          </Field>
                        </Col>
                        {(columns
                          .map(column => column.isIdentifier)
                          .filter(isIdentifier => !!isIdentifier).length < 3 ||
                          columns[index].isIdentifier) &&
                        columns[index].type !== LONGTEXT &&
                        columns[index].type !== IMAGE ? ( // Image and long text cannot be identifiers.
                          <Col span={2}>
                            <Field name={`columns[${index}].isIdentifier`}>
                              {({ field }) => (
                                <Form.Item>
                                  <Switch
                                    onChange={value =>
                                      setFieldValue(
                                        `columns[${index}].isIdentifier`,
                                        value
                                      )
                                    }
                                    checked={field.value}
                                    size="small"
                                  />
                                </Form.Item>
                              )}
                            </Field>
                          </Col>
                        ) : (
                          <Col span={2} />
                        )}
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
                    type="primary"
                  >
                    Add Field
                  </Button>
                </>
              )}
            </FieldArray>
            <Divider />
          </>
        )}
      </form>
      <ItemDetailsCard
        title="Preview"
        columns={columns}
        statusCode={STATUS_CODE.REGISTERED}
      />
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
    tcrTitle: PropTypes.string.isRequired,
    tcrDescription: PropTypes.string.isRequired,
    arbitratorAddress: PropTypes.string.isRequired,
    governorAddress: PropTypes.string.isRequired,
    submissionChallengeBaseDeposit: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired,
    removalChallengeBaseDeposit: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired,
    submissionBaseDeposit: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired,
    removalBaseDeposit: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired,
    challengePeriodDuration: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.string
    ]).isRequired,
    requireRemovalEvidence: PropTypes.bool.isRequired,
    columns: PropTypes.arrayOf(
      PropTypes.shape({
        description: PropTypes.string.isRequired,
        label: PropTypes.string.isRequired,
        type: PropTypes.string.isRequired,
        isIdentifier: PropTypes.bool
      })
    ).isRequired,
    isTCRofTCRs: PropTypes.bool
  }).isRequired
}

export default withFormik({
  validationSchema,
  mapPropsToValues: ({ tcrState }) => tcrState,
  handleSubmit: (_, { props: { postSubmit } }) => {
    postSubmit()
  }
})(ItemParams)
