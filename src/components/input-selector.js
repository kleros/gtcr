import React, { useCallback, useState } from 'react'
import { Form, Switch, Input, Upload, message, Icon } from 'antd'
import PropTypes from 'prop-types'
import { Field } from 'formik'
import styled from 'styled-components/macro'
import { getExtension } from 'mime'
import itemTypes from '../utils/item-types.js'
import CustomInput from './custom-input.js'
import ipfsPublish from '../utils/ipfs-publish.js'
import { sanitize } from '../utils/string.js'

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

const InputSelector = ({
  type,
  setFieldValue,
  maxFileSizeMb,
  allowedFileTypes,
  ...props
}) => {
  const [uploading, setUploading] = useState()
  const customRequest = useCallback(
    fieldName => async ({ file, onSuccess, onError }) => {
      try {
        const data = await new Response(new Blob([file])).arrayBuffer()
        const ipfsFileObj = await ipfsPublish(sanitize(file.name), data)
        const fileURI = `/ipfs/${ipfsFileObj[1].hash}${ipfsFileObj[0].path}`

        setFieldValue(fieldName, fileURI)
        onSuccess('ok', `${process.env.REACT_APP_IPFS_GATEWAY}${fileURI}`)
      } catch (err) {
        console.error(err)
        onError(err)
      }
    },
    [setFieldValue]
  )

  const fileUploadStatusChange = useCallback(({ file: { status } }) => {
    if (status === 'done') message.success(`File uploaded successfully.`)
    else if (status === 'error') message.error(`File upload failed.`)
    else if (status === 'uploading') setUploading(true)

    if (status === 'error' || status === 'done') setUploading(false)
  }, [])

  const beforeImageUpload = useCallback(
    file => {
      if (
        file.type !== 'image/png' &&
        file.type !== 'image/svg+xml' &&
        file.type !== 'image/jpeg'
      ) {
        message.error('Please use PNG, JPEG or SVG.')
        return false
      }

      if (file.size / 1024 / 1024 > (maxFileSizeMb || 2)) {
        message.error(`Image must smaller than ${maxFileSizeMb || 2}MB.`)
        return false
      }

      return true
    },
    [maxFileSizeMb]
  )

  const beforeFileUpload = useCallback(
    file => {
      const allowedFileTypesArr = allowedFileTypes.split(' ')
      if (!allowedFileTypesArr.includes(getExtension(file.type))) {
        message.error(
          allowedFileTypesArr.length > 1
            ? `Allowed file types are+${allowedFileTypesArr.map(e => ` .${e}`)}`
            : `The only allowed file type is .${allowedFileTypesArr[0]}`
        )
        return false
      }

      if (file.size / 1024 / 1024 > (maxFileSizeMb || 10)) {
        message.error(`File must smaller than ${maxFileSizeMb || 10}MB.`)
        return false
      }

      return true
    },
    [allowedFileTypes, maxFileSizeMb]
  )

  const { values, label, name } = props

  switch (type) {
    case itemTypes.TEXT:
    case itemTypes.GTCR_ADDRESS:
    case itemTypes.ADDRESS:
    case itemTypes.NUMBER:
    case itemTypes.LINK:
      return <CustomInput type={type} name={name} hasFeedback {...props} />
    case itemTypes.BOOLEAN:
      return (
        <Field name={name}>
          {({ field }) => (
            <Form.Item label={label} style={{ display: 'flex' }}>
              <Switch
                {...field}
                onChange={value => setFieldValue(name, value)}
              />
            </Form.Item>
          )}
        </Field>
      )
    case itemTypes.LONGTEXT:
      return (
        <Field name={name}>
          {({ field }) => (
            <Form.Item label={label}>
              <Input.TextArea autosize={{ minRows: 2 }} {...field} />
            </Form.Item>
          )}
        </Field>
      )
    case itemTypes.IMAGE:
      return (
        <>
          {label}:
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
              <a href={`${process.env.REACT_APP_IPFS_GATEWAY}${values[name]}`}>
                <img
                  src={`${process.env.REACT_APP_IPFS_GATEWAY}${values[name]}`}
                  style={{ height: '70px', objectFit: 'contain' }}
                  alt="preview"
                />
              </a>
            ) : (
              <UploadButton loading={uploading} />
            )}
          </StyledUpload>
        </>
      )
    case itemTypes.FILE:
      return (
        <>
          {label}:
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
              <a href={`${process.env.REACT_APP_IPFS_GATEWAY}${values[name]}`}>
                <Icon type="file" style={{ fontSize: '30px' }} />
              </a>
            ) : (
              <UploadButton loading={uploading} />
            )}
          </StyledUpload>
        </>
      )
    default:
      throw new Error(`Unhandled input type ${type}`)
  }
}

InputSelector.propTypes = {
  type: PropTypes.oneOf(Object.values(itemTypes))
}

export default InputSelector
