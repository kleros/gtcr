import React, { useState } from 'react'
import { Input, Checkbox, Upload, Icon, message } from 'antd'
import styled from 'styled-components/macro'

const StyledCheckbox = styled(Checkbox)`
  margin-bottom: 1em;
`

const StyledTextArea = styled(Input.TextArea)`
  margin-bottom: 1em;
`

const EvidenceForm = () => {
  const [includeAttachment, setIncludeAttachment] = useState()
  const fileUploadStatusChange = ({ file: { status } }) => {
    // TODO: Update UI
    if (status === 'done') message.success(`Evidence uploaded successfully.`)
    else if (status === 'error') message.error(`Evidence upload failed.`)
  }
  const beforeUpload = async () => {
    // TODO: Remove meta data that could identify submitter.
  }
  const action = async () => {
    // TODO: Upload attatchment to IPFS.
  }

  return (
    <>
      <StyledTextArea rows={4} />
      <StyledCheckbox
        onChange={({ target: { checked } }) => setIncludeAttachment(checked)}
      >
        Include attachment
      </StyledCheckbox>
      {includeAttachment && (
        <Upload.Dragger
          name="evidence"
          onChange={fileUploadStatusChange}
          beforeUpload={beforeUpload}
          action={action}
          multiple={false}
        >
          <p className="ant-upload-drag-icon">
            <Icon type="inbox" />
          </p>
          <p className="ant-upload-hint">
            Click or drag file to this area to upload
          </p>
        </Upload.Dragger>
      )}
    </>
  )
}

export default EvidenceForm
