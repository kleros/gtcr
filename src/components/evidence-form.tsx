import React, { useCallback, useEffect, useState } from 'react'
import { Input, Checkbox, Upload, Form } from 'components/ui'
import Icon from 'components/ui/Icon'
import { toast } from 'react-toastify'
import styled from 'styled-components'
import { withFormik, Field } from 'formik'
import * as yup from 'yup'

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

const UploadButton = () => (
  <div style={{ textAlign: 'center' }}>
    <Icon type="plus" />
    <div className="ui-upload-text">Attach</div>
  </div>
)

interface EvidenceFormProps {
  formID: string
  detailed?: boolean
  handleSubmit: (...args: unknown[]) => void
  setFieldValue: (field: string, value: unknown) => void
  values: Record<string, any>
}

const EvidenceForm = ({
  formID,
  detailed,
  handleSubmit,
  setFieldValue,
  values,
}: EvidenceFormProps) => {
  const [includeAttachment, setIncludeAttachment] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Defer the actual IPFS upload to submit time. The parent modal's Submit
  // button is the EnsureAuth/SIWE gate; if we uploaded here the request would
  // race the sign-in flow and fail before the user is verified.
  const customRequest = useCallback(
    ({ file, onSuccess }) => {
      setFieldValue('evidenceAttachment', file)
      onSuccess('ok', file)
    },
    [setFieldValue],
  )

  const beforeFileUpload = useCallback((file) => {
    const isLt4M = file.size / 1024 / 1024 < 4
    if (!isLt4M) toast.error('File must be smaller than 4MB.')
    return isLt4M
  }, [])

  useEffect(() => {
    const file = values.evidenceAttachment as File | undefined
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [values.evidenceAttachment])

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
        >
          {values.evidenceAttachment && previewUrl ? (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              {(values.evidenceAttachment as File).type.includes('image') ? (
                <StyledImg src={previewUrl} alt="attachment preview" />
              ) : (
                <StyledIcon type="file-pdf" />
              )}
            </a>
          ) : (
            <UploadButton />
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
      .max(1024, 'The description must be less than 1024 characters long.'),
  })

export default withFormik({
  validationSchema,
  handleSubmit: (values, { props: { onSubmit } }) => {
    onSubmit(values)
  },
})(EvidenceForm)
