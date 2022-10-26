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
  Tooltip,
  message,
  Alert
} from 'antd'
import { withFormik, FieldArray, Field } from 'formik'
import React, { useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import * as yup from 'yup'
import styled from 'styled-components/macro'
import CustomInput from 'components/custom-input'
import ItemDetailsCard from 'components/item-details-card'
import { ItemTypes as AllItemTypes } from '@kleros/gtcr-encoder'
import { STATUS_CODE } from 'utils/item-status'
import objectWithoutKey from 'utils/object-without-key'

const ItemTypes = objectWithoutKey(AllItemTypes, 'TWITTER_USER_ID')

const { IMAGE, FILE, GTCR_ADDRESS, LONG_TEXT } = AllItemTypes

const StyledAlert = styled(Alert)`
  margin-bottom: 42px;
`

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
  const { tcrState } = rest || {}
  const { tcrLogo, tcrPrimaryDocument, tcrDescription, tcrTitle } =
    tcrState || {}

  const toggleTCRofTCRs = useCallback(() => {
    if (!isTCRofTCRs) {
      setFieldValue(`columns`, [
        {
          label: 'Address',
          description: 'The list address.',
          type: GTCR_ADDRESS,
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
    if (value === LONG_TEXT)
      // Long text fields cannot be identifiers.
      setFieldValue(`columns[${index}].isIdentifier`, false)
    if (value === IMAGE)
      // Image fields cannot be identifiers.
      setFieldValue(`columns[${index}].isIdentifier`, false)
  }

  return (
    <Card title="Choose the item parameters">
      <Row>
        <Col span={24}>
          Is this a list of lists?
          <Tooltip title="A list of lists has only one column: the list address. Information such as its title, description and logo will be pulled from the list itself.">
            &nbsp;
            <Icon type="question-circle-o" />
          </Tooltip>
          {'  '}
          <Switch checked={isTCRofTCRs} onChange={toggleTCRofTCRs} />
        </Col>
      </Row>
      <Divider />
      {!isTCRofTCRs && (
        <>
          <StyledAlert
            description="The column order defined here will be used to display the items. In other words, if your item has an image or title, you probably want it to be the first columns displayed."
            type="info"
            showIcon
            closable
          />
          <Row
            gutter={{ xs: 3, sm: 6, md: 10 }}
            type="flex"
            justify="space-between"
          >
            <Col span={4}>
              Name
              <Tooltip title="This will be the field label displayed to users when submitting an item.">
                &nbsp;
                <Icon type="question-circle-o" />
              </Tooltip>
            </Col>
            <Col span={6}>
              Description
              <Tooltip title="This will be the text displayed when the user clicks the '?' symbol near the field label.">
                &nbsp;
                <Icon type="question-circle-o" />
              </Tooltip>
            </Col>
            <Col span={4}>
              Type
              <Tooltip title="This is the column type">
                &nbsp;
                <Icon type="question-circle-o" />
              </Tooltip>
            </Col>
            <Col span={3}>
              Indexed
              <Tooltip title="Indexed fields are searcheable and displayed on the card in the items view (along with image field types). Toggle these for the fields you consider most important.">
                &nbsp;
                <Icon type="question-circle-o" />
              </Tooltip>
            </Col>
            {columns.filter(col => col.type === FILE).length > 0 ? (
              <Col span={4}>
                Allowed File Types
                <Tooltip title="A list of space separated allowed file extensions (e.g.: pdf doc  mp3).">
                  &nbsp;
                  <Icon type="question-circle-o" />
                </Tooltip>
              </Col>
            ) : (
              <Col span={4} />
            )}
            {columns.length > 1 && <Col span={1} />}
          </Row>
        </>
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
                        gutter={{ xs: 3, sm: 6, md: 10 }}
                        key={index}
                        type="flex"
                        justify="space-between"
                      >
                        <Col span={4}>
                          <CustomInput
                            name={`columns[${index}].label`}
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
                        <Col span={6}>
                          <CustomInput
                            name={`columns[${index}].description`}
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
                        <Col span={4}>
                          <Field name={`columns[${index}].type`}>
                            {({ field }) => (
                              <Form.Item>
                                <Select
                                  {...field}
                                  value={columns[index].type}
                                  onChange={value => onTypeChange(index, value)}
                                >
                                  {Object.values(ItemTypes).map(
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
                          .filter(isIdentifier => !!isIdentifier).length < 5 ||
                          columns[index].isIdentifier) &&
                        columns[index].type !== LONG_TEXT &&
                        columns[index].type !== IMAGE &&
                        columns[index].type !== FILE ? ( // Image, file and long text cannot be identifiers.
                          <Col span={3}>
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
                          <Col span={3} />
                        )}
                        {columns[index].type === FILE ? (
                          <Col span={4}>
                            <CustomInput
                              name={`columns[${index}].allowedFileTypes`}
                              hasFeedback
                              touched={
                                touched.columns &&
                                touched.columns[index] &&
                                touched.columns[index].allowedFileTypes
                              }
                              error={
                                errors.columns &&
                                errors.columns[index] &&
                                errors.columns[index].allowedFileTypes
                              }
                              {...rest}
                            />
                          </Col>
                        ) : (
                          <Col span={4} />
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
        itemMetaEvidence={
          isTCRofTCRs && {
            file: {
              fileURI: tcrPrimaryDocument,
              metadata: {
                tcrTitle,
                tcrDescription,
                logoURI: tcrLogo
              }
            }
          }
        }
        style={{ maxWidth: '250px' }}
      />
    </Card>
  )
}

const validationSchema = yup.object().shape({
  columns: yup.array().of(
    yup.object().shape({
      label: yup.string().required('The column label is required.'),
      description: yup.string().required('The column description is required.'),
      allowedFileTypes: yup.string().when('type', {
        is: FILE,
        then: yup.string().required('At least one file type is required.')
      })
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
        allowedFileTypes: PropTypes.string,
        isIdentifier: PropTypes.bool
      })
    ).isRequired,
    isTCRofTCRs: PropTypes.bool
  }).isRequired
}

export default withFormik({
  validationSchema,
  mapPropsToValues: ({ tcrState }) => tcrState,
  handleSubmit: ({ columns }, { props: { postSubmit } }) => {
    if (!columns.some(c => c.isIdentifier)) {
      message.warning('At least one ID field is required.')
      return
    }
    const usedLabels = new Set()
    for (const col of columns) {
      if (usedLabels.has(col.label)) {
        message.warning('Column names must be unique.')
        return
      }
      usedLabels.add(col.label)
    }
    postSubmit()
  }
})(ItemParams)
