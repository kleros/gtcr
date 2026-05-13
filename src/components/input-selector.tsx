import React, { useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'
import { Form, Switch, Input, Upload } from 'components/ui'
import Icon from 'components/ui/Icon'
import { toast } from 'react-toastify'
import { Field } from 'formik'
import { getExtension } from 'mime'
import { ItemTypes } from '@kleros/gtcr-encoder'
import CustomInput from './custom-input'
import { parseIpfs } from 'utils/ipfs-parse'
import AddressInput from './address-input'
import RichAddressInput from './rich-address-input'

export const StyledUpload = styled(Upload)`
  & > .ui-upload.ui-upload-select-picture-card {
    width: 100%;
  }
`

const StyledImg = styled.img<React.ImgHTMLAttributes<HTMLImageElement>>`
  height: 70px;
  object-fit: contain;
`

const StyledUploadButtonText = styled.div`
  color: ${({ theme }) => theme.textPrimary};
`

export const UploadButton: React.FC<{ loading: boolean }> = ({ loading }) => (
  <div style={{ textAlign: 'center' }}>
    <Icon type={loading ? 'loading' : 'plus'} />
    <StyledUploadButtonText className="ui-upload-text">
      Upload
    </StyledUploadButtonText>
  </div>
)

interface InputSelectorProps extends React.HTMLAttributes<HTMLElement> {
  type: string
  name: string
  values: Record<string, unknown>
  error: Record<string, string> | undefined
  setFieldValue: (fieldName: string, value: unknown) => void
  disabled: boolean
  touched: boolean
  maxFileSizeMb?: number
  label: string
  allowedFileTypes: string
  style: React.CSSProperties
}

const useObjectUrl = (file: File | null): string | null => {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!file) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  return url
}

type UploadAdapter = ({
  file,
  onSuccess,
}: {
  file: File
  onSuccess: (body: string, url: string) => void
}) => void

interface PreviewUploadProps {
  name: string
  value: unknown
  stashFile: (fieldName: string) => UploadAdapter
  beforeUpload: (file: File) => boolean
}

const ImagePreviewUpload: React.FC<PreviewUploadProps> = ({
  name,
  value,
  stashFile,
  beforeUpload,
}) => {
  const file = value instanceof File ? value : null
  const blobUrl = useObjectUrl(file)
  const ipfsUrl =
    !file && typeof value === 'string' && value ? parseIpfs(value) : null
  const previewSrc = blobUrl ?? ipfsUrl
  return (
    // @ts-ignore
    <StyledUpload
      name={name}
      listType="picture-card"
      className="avatar-uploader"
      showUploadList={false}
      customRequest={stashFile(name)}
      beforeUpload={beforeUpload}
    >
      {previewSrc ? (
        ipfsUrl ? (
          <a href={ipfsUrl} target="_blank" rel="noopener noreferrer">
            <StyledImg src={previewSrc} alt="preview" />
          </a>
        ) : (
          <StyledImg src={previewSrc} alt="preview" />
        )
      ) : (
        <UploadButton loading={false} />
      )}
    </StyledUpload>
  )
}

const FilePreviewUpload: React.FC<PreviewUploadProps> = ({
  name,
  value,
  stashFile,
  beforeUpload,
}) => {
  const ipfsUrl =
    !(value instanceof File) && typeof value === 'string' && value
      ? parseIpfs(value)
      : null
  const hasFile = value instanceof File || !!ipfsUrl
  return (
    // @ts-ignore
    <StyledUpload
      name={name}
      listType="picture-card"
      className="avatar-uploader"
      showUploadList={false}
      customRequest={stashFile(name)}
      beforeUpload={beforeUpload}
    >
      {hasFile ? (
        ipfsUrl ? (
          <a href={ipfsUrl} target="_blank" rel="noopener noreferrer">
            <Icon type="file" style={{ fontSize: '30px' }} />
          </a>
        ) : (
          <Icon type="file" style={{ fontSize: '30px' }} />
        )
      ) : (
        <UploadButton loading={false} />
      )}
    </StyledUpload>
  )
}

const InputSelector: React.FC<InputSelectorProps> = (p) => {
  const stashFile = useCallback(
    (fieldName: string) =>
      ({
        file,
        onSuccess,
      }: {
        file: File
        onSuccess: (body: string, url: string) => void
      }) => {
        p.setFieldValue(fieldName, file)
        onSuccess('ok', '')
      },
    [p],
  )

  const beforeImageUpload = useCallback(
    (file) => {
      if (
        file.type !== 'image/png' &&
        file.type !== 'image/svg+xml' &&
        file.type !== 'image/webp' &&
        file.type !== 'image/jpeg'
      ) {
        toast.error('Please use PNG, jpeg, webp or SVG.')
        return false
      }

      if (file.size / 1024 / 1024 > (p.maxFileSizeMb || 2)) {
        toast.error(`Image must be smaller than ${p.maxFileSizeMb || 2}MB.`)
        return false
      }

      return true
    },
    [p.maxFileSizeMb],
  )

  const beforeFileUpload = useCallback(
    (file) => {
      const allowedFileTypesArr = p.allowedFileTypes.split(' ')
      if (!allowedFileTypesArr.includes(getExtension(file.type) as string)) {
        toast.error(
          allowedFileTypesArr.length > 1
            ? `Allowed file types are+${allowedFileTypesArr.map((e) => ` .${e}`)}`
            : `The only allowed file type is .${allowedFileTypesArr[0]}`,
        )
        return false
      }

      if (file.size / 1024 / 1024 > (p.maxFileSizeMb || 4)) {
        toast.error(`File must be smaller than ${p.maxFileSizeMb || 4}MB.`)
        return false
      }

      return true
    },
    [p.allowedFileTypes, p.maxFileSizeMb],
  )

  const { values, label, name } = p
  switch (p.type) {
    case ItemTypes.TEXT:
    case ItemTypes.NUMBER:
    case ItemTypes.LINK:
      return <CustomInput hasFeedback {...p} />
    case ItemTypes.ADDRESS:
    case ItemTypes.GTCR_ADDRESS:
      return <AddressInput placeholder="address" hasFeedback {...p} />
    case ItemTypes.RICH_ADDRESS:
      return <RichAddressInput hasFeedback {...p} />
    case ItemTypes.BOOLEAN:
      return (
        <Field name={name}>
          {({ field }: { field: Record<string, unknown> }) => (
            <Form.Item label={label} style={{ display: 'flex' }}>
              <Switch
                {...field}
                onChange={(value) => p.setFieldValue(name, String(value))}
              />
            </Form.Item>
          )}
        </Field>
      )
    case ItemTypes.LONG_TEXT:
      return (
        <Field name={name}>
          {({ field }: { field: Record<string, unknown> }) => (
            <Form.Item label={label}>
              <Input.TextArea autosize={{ minRows: 2 }} {...field} />
            </Form.Item>
          )}
        </Field>
      )
    case ItemTypes.IMAGE:
      return (
        <>
          {label}:
          <ImagePreviewUpload
            name={name}
            value={values[name]}
            stashFile={stashFile}
            beforeUpload={beforeImageUpload}
          />
        </>
      )
    case ItemTypes.FILE:
      return (
        <>
          {label}:
          <FilePreviewUpload
            name={name}
            value={values[name]}
            stashFile={stashFile}
            beforeUpload={beforeFileUpload}
          />
        </>
      )
    default:
      throw new Error(`Unhandled input type ${p.type}`)
  }
}

export default InputSelector
