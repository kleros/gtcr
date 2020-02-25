import React, { useCallback, useState } from 'react'
import { Form, Switch, Input, Upload, message, Icon } from 'antd'
import PropTypes from 'prop-types'
import itemTypes from '../utils/item-types.js'
import CustomInput from './custom-input.js'
import { Field } from 'formik'
import styled from 'styled-components/macro'
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

const InputSelector = ({ type, setFieldValue, maxImgSizeMb, ...props }) => {
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
      const isPNGorJPEGorSVG =
        file.type === 'image/png' ||
        file.type === 'image/svg+xml' ||
        file.type === 'image/jpeg'
      if (!isPNGorJPEGorSVG) message.error('Please use PNG, JPEG or SVG.')

      const isLt2M = file.size / 1024 / 1024 < (maxImgSizeMb || 2)
      if (!isLt2M)
        message.error(`Image must smaller than ${maxImgSizeMb || 2}MB.`)

      return isPNGorJPEGorSVG && isLt2M
    },
    [maxImgSizeMb]
  )

  const { values, label, name } = props

  switch (type) {
    case itemTypes.TEXT:
    case itemTypes.GTCR_ADDRESS:
    case itemTypes.ADDRESS:
    case itemTypes.NUMBER:
      return <CustomInput type={type} {...props} name={name} />
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
            <img
              src={`${process.env.REACT_APP_IPFS_GATEWAY}${values[name]}`}
              style={{ height: '70px', objectFit: 'contain' }}
              alt="preview"
            />
          ) : (
            <UploadButton loading={uploading} />
          )}
        </StyledUpload>
      )
    default:
      throw new Error(`Unhandled input type ${type}`)
  }
}

InputSelector.propTypes = {
  type: PropTypes.oneOf(Object.values(itemTypes))
}

export default InputSelector
