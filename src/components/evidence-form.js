import React, { useState, useCallback } from 'react'
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

const StyledUpload = styled(Upload)`
  & > .ant-upload.ant-upload-select-picture-card {
    width: 100%;
  }
`

const UploadButton = ({ loading }) => (
  <div>
    <Icon type={loading ? 'loading' : 'plus'} />
    <div className="ant-upload-text">Upload</div>
  </div>
)

UploadButton.propTypes = {
  loading: PropTypes.bool
}

UploadButton.defaultProps = {
  loading: null
}

const EvidenceForm = ({
  formID,
  detailed, // Should the evidence form let the user input an evidence title?

  // Formik bag
  handleSubmit,
  setFieldValue,
  values
}) => {
  const [includeAttachment, setIncludeAttachment] = useState()
  const [uploading, setUploading] = useState()
  const fileUploadStatusChange = useCallback(({ file: { status } }) => {
    if (status === 'done') message.success(`File uploaded successfully.`)
    else if (status === 'error') message.error(`File upload failed.`)
    else if (status === 'uploading') setUploading(true)

    if (status === 'error' || status === 'done') setUploading(false)
  }, [])

  const customRequest = async ({ file, onSuccess, onError }) => {
    try {
      const fileTypeExtension = file.name.split('.')[1]
      const data = await new Response(new Blob([file])).arrayBuffer()
      const ipfsFileObj = await ipfsPublish(sanitize(file.name), data)
      const fileURI = `/ipfs/${ipfsFileObj[1].hash}${ipfsFileObj[0].path}`

      setFieldValue('evidenceAttachment', {
        fileURI,
        fileTypeExtension,
        type: file.type
      })
      onSuccess('ok', `${process.env.REACT_APP_IPFS_GATEWAY}${fileURI}`)
    } catch (err) {
      console.error(err)
      onError(err)
    }
  }

  const beforeFileUpload = useCallback(file => {
    const isLt10M = file.size / 1024 / 1024 < 15
    if (!isLt10M) message.error('File must smaller than 15MB.')
    return isLt10M
  }, [])

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
        <StyledUpload
          name="evidence"
          listType="picture-card"
          className="avatar-uploader"
          showUploadList={false}
          customRequest={customRequest}
          beforeUpload={beforeFileUpload}
          onChange={fileUploadStatusChange}
        >
          {values.evidenceAttachment ? (
            <a
              target="_blank"
              rel="noopener noreferrer"
              href={`${process.env.REACT_APP_IPFS_GATEWAY}${values.evidenceAttachment.fileURI}`}
            >
              {values.evidenceAttachment.type.includes('image') ? (
                <img
                  src={`${process.env.REACT_APP_IPFS_GATEWAY}${values.evidenceAttachment.fileURI}`}
                  style={{
                    height: '70px',
                    objectFit: 'contain'
                  }}
                  alt="avatar"
                />
              ) : (
                <Icon type="file-pdf" style={{ fontSize: '30px' }} />
              )}
            </a>
          ) : (
            <UploadButton loading={uploading} />
          )}
        </StyledUpload>
      )}
    </Form>
  )
}

EvidenceForm.propTypes = {
  formID: PropTypes.string.isRequired,
  detailed: PropTypes.bool,
  handleSubmit: PropTypes.func.isRequired,
  setFieldValue: PropTypes.func.isRequired,
  values: PropTypes.shape({
    formID: PropTypes.string,
    detailed: PropTypes.bool,
    title: PropTypes.string,
    description: PropTypes.string,
    evidenceAttachment: PropTypes.shape({
      fileURI: PropTypes.string,
      fileTypesExtension: PropTypes.string,
      type: PropTypes.string
    })
  })
}

EvidenceForm.defaultProps = {
  detailed: false,
  values: null
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
