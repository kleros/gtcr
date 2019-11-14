import React, { useState } from 'react'
import { Input, Checkbox, Upload, Icon, message, Form } from 'antd'
import styled from 'styled-components/macro'
import { withFormik, Field } from 'formik'
import * as yup from 'yup'
import PropTypes from 'prop-types'
import ipfsPublish from '../utils/ipfs-publish'
import { sanitize } from '../utils/string'

const StyledCheckbox = styled(Checkbox)`
  margin-bottom: 1em;
`

const EvidenceForm = ({
  formID,
  detailed, // Should the evidence form let the user input an evidence title?

  // Formik bag
  handleSubmit,
  setFieldValue
}) => {
  const [includeAttachment, setIncludeAttachment] = useState()

  const fileUploadStatusChange = ({ file: { status } }) => {
    if (status === 'done') message.success(`Evidence uploaded successfully.`)
    else if (status === 'error') message.error(`Evidence upload failed.`)
  }

  const customRequest = async ({ file, onSuccess, onError }) => {
    try {
      const fileTypeExtension = file.name.split('.')[1]
      const data = await new Response(new Blob([file])).arrayBuffer()
      const ipfsFileObj = await ipfsPublish(sanitize(file.name), data)
      const fileURI = `/ipfs/${ipfsFileObj[1].hash}${ipfsFileObj[0].path}`

      setFieldValue('evidenceAttachment', {
        fileURI,
        fileTypeExtension
      })
      onSuccess('ok', `${process.env.REACT_APP_IPFS_GATEWAY}${fileURI}`)
    } catch (err) {
      console.error(err)
      onError(err)
    }
  }

  return (
    <Form id={formID} onSubmit={handleSubmit}>
      {detailed && (
        <Field name="title">
          {({ field: { name }, field, form: { errors } }) => (
            <Form.Item
              name={name}
              validateStatus={errors[name] ? 'error' : undefined}
              help={errors[name] ? errors[name] : ''}
              hasFeedback
            >
              <Input {...field} placeholder="Title" />
            </Form.Item>
          )}
        </Field>
      )}
      <Field name="description">
        {({ field, field: { name }, form: { errors } }) => (
          <Form.Item
            validateStatus={errors[name] ? 'error' : undefined}
            help={errors[name] ? errors[name] : ''}
            hasFeedback
          >
            <Input.TextArea rows={4} {...field} placeholder="Description" />
          </Form.Item>
        )}
      </Field>
      <StyledCheckbox
        onChange={({ target: { checked } }) => setIncludeAttachment(checked)}
      >
        Include attachment
      </StyledCheckbox>
      {includeAttachment && (
        <Upload.Dragger
          name="evidence"
          onChange={fileUploadStatusChange}
          customRequest={customRequest}
          multiple={false}
        >
          <p className="ant-upload-drag-icon">
            <Icon type="inbox" />
          </p>
          <p className="ant-upload-hint">
            Click or drag a file to this area to upload
          </p>
        </Upload.Dragger>
      )}
    </Form>
  )
}

EvidenceForm.propTypes = {
  formID: PropTypes.string.isRequired,
  detailed: PropTypes.bool,
  handleSubmit: PropTypes.func.isRequired,
  setFieldValue: PropTypes.func.isRequired
}

EvidenceForm.defaultProps = {
  detailed: false
}

const validationSchema = ({ detailed }) =>
  yup.object().shape({
    title: detailed
      ? yup
          .string()
          .required('An evidence title is required.')
          .max(255, 'The evidence title should be at most 255 characters long.')
      : null,
    description: yup
      .string()
      .required('An evidence description is required.')
      .max(1024, 'The description must be less than 1024 characters long.')
  })

export default withFormik({
  validationSchema,
  handleSubmit: (values, { props: { onSubmit } }) => {
    onSubmit(values)
  }
})(EvidenceForm)
