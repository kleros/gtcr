import React, { useCallback, useState } from 'react'
import styled from 'styled-components'
import { Form, Switch, Input, Upload, message, Icon } from 'antd'
import { Field } from 'formik'
import { getExtension } from 'mime'
import { ItemTypes } from '@kleros/gtcr-encoder'
import CustomInput from './custom-input.js'
import ipfsPublish from '../utils/ipfs-publish.js'
import { sanitize } from '../utils/string.js'
import AddressInput from './address-input'
import RichAddressInput from './rich-address-input'
import { parseIpfs } from 'utils/ipfs-parse'

export const StyledUpload = styled(Upload)`
  & > .ant-upload.ant-upload-select-picture-card {
    width: 100%;
  }
`

const StyledImg = styled.img`
  height: 70px;
  object-fit: contain;
`

export const UploadButton: React.FC<{ loading: boolean }> = ({ loading }) => (
  <div>
    <Icon type={loading ? 'loading' : 'plus'} />
    <div className="ant-upload-text">Upload</div>
  </div>
)

interface InputSelectorProps extends React.HTMLAttributes<HTMLElement> {
  type: string
  name: string
  values: any
  error: any
  setFieldValue: (fieldName: string, two: any) => void
  disabled: boolean
  touched: boolean
  maxFileSizeMb?: number
  label: any
  allowedFileTypes: string
  setFileToUpload: (f: (b: boolean) => void) => void
  setFileAsUploaded: (f: (b: boolean) => void) => void
  style: any
}

const InputSelector: React.FC<InputSelectorProps> = p => {
  const [uploading, setUploading] = useState<boolean>(false)
  const customRequest = useCallback(
    fieldName => async ({ file, onSuccess, onError }: any) => {
      try {
        const data = await new Response(new Blob([file])).arrayBuffer()
        const ipfsFileObj: any = await ipfsPublish(sanitize(file.name), data)
        const fileURI = `/ipfs/${ipfsFileObj.cids[0].split('ipfs://')[1]}`

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
      if (status === 'done') message.success(`File uploaded successfully.`)
      else if (status === 'error') message.error(`File upload failed.`)
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
        message.error('Please use PNG, jpeg, webp or SVG.')
        return false
      }

      if (file.size / 1024 / 1024 > (p.maxFileSizeMb || 2)) {
        message.error(`Image must smaller than ${p.maxFileSizeMb || 2}MB.`)
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
        message.error(
          allowedFileTypesArr.length > 1
            ? `Allowed file types are+${allowedFileTypesArr.map(e => ` .${e}`)}`
            : `The only allowed file type is .${allowedFileTypesArr[0]}`
        )
        return false
      }

      if (file.size / 1024 / 1024 > (p.maxFileSizeMb || 10)) {
        message.error(`File must smaller than ${p.maxFileSizeMb || 10}MB.`)
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
          {({ field }: any) => (
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
          {({ field }: any) => (
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
