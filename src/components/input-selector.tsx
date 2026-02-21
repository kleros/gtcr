import React, { useCallback, useState } from 'react'
import styled from 'styled-components'
import { Form, Switch, Input, Upload } from 'components/ui'
import Icon from 'components/ui/Icon'
import { toast } from 'react-toastify'
import { Field } from 'formik'
import { getExtension } from 'mime'
import { ItemTypes } from '@kleros/gtcr-encoder'
import CustomInput from './custom-input'
import ipfsPublish from '../utils/ipfs-publish'
import { sanitize } from '../utils/string'
import { IPFSResultObject, getIPFSPath } from '../utils/get-ipfs-path'
import { parseIpfs } from 'utils/ipfs-parse'
import AddressInput from './address-input'
import RichAddressInput from './rich-address-input'

export const StyledUpload = styled(Upload)`
  & > .ui-upload.ui-upload-select-picture-card {
    width: 100%;
  }
`

const StyledImg = styled.img`
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
  setFileToUpload: (f: (b: boolean) => void) => void
  setFileAsUploaded: (f: (b: boolean) => void) => void
  style: React.CSSProperties
}

const InputSelector: React.FC<InputSelectorProps> = p => {
  const [uploading, setUploading] = useState<boolean>(false)
  const customRequest = useCallback(
    fieldName => async ({ file, onSuccess, onError }: { file: File; onSuccess: (body: string, url: string) => void; onError: (err: unknown) => void }) => {
      try {
        const data = await new Response(new Blob([file])).arrayBuffer()
        const fileURI = getIPFSPath(
          (await ipfsPublish(sanitize(file.name), data)) as IPFSResultObject
        )

        p.setFieldValue(fieldName, fileURI)
        onSuccess('ok', parseIpfs(fileURI))
      } catch (err) {
        console.error(err)
        onError(err)
      }
    },
    [p]
  )

  const fileUploadStatusChange = useCallback(
    ({ file: { status } }) => {
      if (status === 'done') toast.success(`File uploaded successfully.`)
      else if (status === 'error') toast.error(`File upload failed.`)
      else if (status === 'uploading') p.setFileToUpload(setUploading)

      if (status === 'error' || status === 'done')
        p.setFileAsUploaded(setUploading)
    },
    [p]
  )

  const beforeImageUpload = useCallback(
    file => {
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
    [p.maxFileSizeMb]
  )

  const beforeFileUpload = useCallback(
    file => {
      const allowedFileTypesArr = p.allowedFileTypes.split(' ')
      if (!allowedFileTypesArr.includes(getExtension(file.type) as string)) {
        toast.error(
          allowedFileTypesArr.length > 1
            ? `Allowed file types are+${allowedFileTypesArr.map(e => ` .${e}`)}`
            : `The only allowed file type is .${allowedFileTypesArr[0]}`
        )
        return false
      }

      if (file.size / 1024 / 1024 > (p.maxFileSizeMb || 4)) {
        toast.error(`File must be smaller than ${p.maxFileSizeMb || 4}MB.`)
        return false
      }

      return true
    },
    [p.allowedFileTypes, p.maxFileSizeMb]
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
                onChange={value => p.setFieldValue(name, String(value))}
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
          {label}:{/* @ts-ignore */}
          <StyledUpload
            name={name}
            listType="picture-card"
            className="avatar-uploader"
            showUploadList={false}
            customRequest={customRequest(name)}
            beforeUpload={beforeImageUpload}
            onChange={fileUploadStatusChange}
          >
            {values[name] ? (
              <a
                href={parseIpfs(values[name])}
                target="_blank"
                rel="noopener noreferrer"
              >
                <StyledImg src={parseIpfs(values[name])} alt="preview" />
              </a>
            ) : (
              <UploadButton loading={uploading} />
            )}
          </StyledUpload>
        </>
      )
    case ItemTypes.FILE:
      return (
        <>
          {label}:{/* @ts-ignore */}
          <StyledUpload
            name={name}
            listType="picture-card"
            className="avatar-uploader"
            showUploadList={false}
            customRequest={customRequest(name)}
            beforeUpload={beforeFileUpload}
            onChange={fileUploadStatusChange}
          >
            {values[name] ? (
              <a
                href={parseIpfs(values[name])}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon type="file" style={{ fontSize: '30px' }} />
              </a>
            ) : (
              <UploadButton loading={uploading} />
            )}
          </StyledUpload>
        </>
      )
    default:
      throw new Error(`Unhandled input type ${p.type}`)
  }
}

export default InputSelector
