import React, { useState, useCallback } from 'react'
import { Input, Checkbox, Upload, Form } from 'components/ui'
import Icon from 'components/ui/Icon'
import { toast } from 'react-toastify'
import styled from 'styled-components'
import { withFormik, Field } from 'formik'
import * as yup from 'yup'
import ipfsPublish from '../utils/ipfs-publish'
import { sanitize } from '../utils/string'
import { parseIpfs } from 'utils/ipfs-parse'
import { getIPFSPath } from 'utils/get-ipfs-path'

const StyledCheckbox = styled(Checkbox)`
  margin-bottom: 1em;
`

const StyledUpload = styled(Upload)`
  & > .ui-upload.ui-upload-select-picture-card {
    width: 100%;
  }
`

const StyledImg = styled.img`
  height: 70px;
  object-fit: contain;
`

const StyledIcon = styled(Icon)`
  font-size: 30px;
`

const UploadButton = ({ loading }: { loading?: boolean | null }) => (
  <div>
    <Icon type={loading ? 'loading' : 'plus'} />
    <div className="ui-upload-text">Upload</div>
  </div>
)

interface EvidenceFormProps {
  formID: string
  detailed?: boolean
  handleSubmit: (...args: any[]) => void
  setFieldValue: (field: string, value: any) => void
  values: any
}

const EvidenceForm = ({
  formID,
  detailed, // Should the evidence form let the user input an evidence title?

  // Formik bag
  handleSubmit,
  setFieldValue,
  values
}: EvidenceFormProps) => {
  const [includeAttachment, setIncludeAttachment] = useState()
  const [uploading, setUploading] = useState()
  const fileUploadStatusChange = useCallback(({ file: { status } }) => {
    if (status === 'done') toast.success(`File uploaded successfully.`)
    else if (status === 'error') toast.error(`File upload failed.`)
    else if (status === 'uploading') setUploading(true)

    if (status === 'error' || status === 'done') setUploading(false)
  }, [])

  const customRequest = async ({ file, onSuccess, onError }) => {
    try {
      const fileTypeExtension = file.name.split('.')[1]
      const data = await new Response(new Blob([file])).arrayBuffer()
      const fileURI = getIPFSPath(await ipfsPublish(sanitize(file.name), data))

      setFieldValue('evidenceAttachment', {
        fileURI,
        fileTypeExtension,
        type: file.type
      })
      onSuccess('ok', parseIpfs(fileURI))
    } catch (err) {
      console.error(err)
      onError(err)
    }
  }

  const beforeFileUpload = useCallback(file => {
    const isLt4M = file.size / 1024 / 1024 < 4
    if (!isLt4M) toast.error('File must be smaller than 4MB.')
    return isLt4M
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
              href={parseIpfs(values.evidenceAttachment.fileURI)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {values.evidenceAttachment.type.includes('image') ? (
                <StyledImg
                  src={parseIpfs(values.evidenceAttachment.fileURI)}
                  alt="avatar"
                />
              ) : (
                <StyledIcon type="file-pdf" />
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
