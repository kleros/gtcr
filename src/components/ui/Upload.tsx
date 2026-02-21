import React, { useState, useRef, useCallback } from 'react'
import styled, { css } from 'styled-components'

const Wrapper = styled.div`
  display: block;
  margin: 8px 0;
`

const PictureCard = styled.div<{ $disabled?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 104px;
  border: 1px dashed ${({ theme }) => theme.borderColor};
  border-radius: 4px;
  background: ${({ theme }) => theme.elevatedBackground};
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  transition: border-color 0.3s;
  color: ${({ theme }) => theme.textSecondary};
  flex-direction: column;
  font-size: 14px;
  gap: 8px;

  &:hover:not([disabled]) {
    border-color: ${({ theme }) => theme.primaryColor};
  }

  ${({ $disabled }) =>
    $disabled &&
    css`
      opacity: 0.65;
    `}
`

const TextTrigger = styled.span<{ $disabled?: boolean }>`
  display: inline-block;
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  ${({ $disabled }) =>
    $disabled &&
    css`
      opacity: 0.65;
    `}
`

const HiddenInput = styled.input`
  display: none;
`

const FileListWrapper = styled.div`
  margin-top: 8px;
`

const FileItem = styled.div<{ $status?: string }>`
  display: flex;
  align-items: center;
  padding: 4px 8px;
  margin-bottom: 4px;
  border-radius: 4px;
  font-size: 13px;
  color: ${({ theme }) => theme.textPrimary};
  background: ${({ theme }) => theme.elevatedBackground};
  transition: background 0.2s;

  ${({ $status, theme }) =>
    $status === 'error' &&
    css`
      color: ${theme.errorColor};
    `}
`

const FileName = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const RemoveBtn = styled.span`
  margin-left: 8px;
  cursor: pointer;
  color: ${({ theme }) => theme.textSecondary};
  font-size: 12px;
  &:hover {
    color: ${({ theme }) => theme.errorColor};
  }
`

const PictureCardList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
`

const PictureCardItem = styled.div<{ $status?: string }>`
  width: 104px;
  height: 104px;
  border: 1px solid ${({ theme }) => theme.borderColor};
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.componentBackground};

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  ${({ $status }) =>
    $status === 'uploading' &&
    css`
      &::after {
        content: '';
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.3);
      }
    `}
`

const PictureCardRemove = styled.span`
  position: absolute;
  top: 2px;
  right: 4px;
  cursor: pointer;
  color: ${({ theme }) => theme.textSecondary};
  font-size: 14px;
  z-index: 1;
  &:hover {
    color: ${({ theme }) => theme.errorColor};
  }
`

interface UploadFile {
  uid: string
  name: string
  size: number
  type: string
  status: string
  originFileObj: File
  thumbUrl: string | null
  response?: any
  error?: any
  percent?: number
}

interface CustomRequestOptions {
  file: File
  onSuccess: (response: any) => void
  onError: (error: any) => void
  onProgress: (percent: number) => void
}

interface UploadProps {
  name?: string
  listType?: string
  className?: string
  showUploadList?: boolean
  customRequest?: (options: CustomRequestOptions) => void
  beforeUpload?: (file: File) => Promise<any> | boolean
  onChange?: (info: { file: UploadFile; fileList: UploadFile[] }) => void
  accept?: string
  multiple?: boolean
  children?: React.ReactNode
  disabled?: boolean
}

let uid = 0

const Upload: React.FC<UploadProps> = ({
  name,
  listType = 'text',
  className,
  showUploadList = true,
  customRequest,
  beforeUpload,
  onChange,
  accept,
  multiple = false,
  children,
  disabled = false
}) => {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const triggerChange = useCallback(
    (file: UploadFile, list: UploadFile[]) => {
      if (onChange) onChange({ file, fileList: list })
    },
    [onChange]
  )

  const removeFile = useCallback(
    (fileUid: string) => {
      setFileList(prev => {
        const next = prev.filter(f => f.uid !== fileUid)
        const removed = prev.find(f => f.uid === fileUid)
        if (removed) triggerChange({ ...removed, status: 'removed' }, next)
        return next
      })
    },
    [triggerChange]
  )

  const processFile = useCallback(
    (file: File) => {
      const fileEntry: UploadFile = {
        uid: `upload-${++uid}`,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'uploading',
        originFileObj: file,
        thumbUrl:
          file.type && file.type.startsWith('image/')
            ? URL.createObjectURL(file)
            : null
      }

      setFileList(prev => {
        const next = [...prev, fileEntry]
        triggerChange(fileEntry, next)
        return next
      })

      if (customRequest) {
        customRequest({
          file,
          onSuccess: (response: any) => {
            setFileList(prev => {
              const next = prev.map(f =>
                f.uid === fileEntry.uid
                  ? { ...f, status: 'done', response }
                  : f
              )
              triggerChange(
                { ...fileEntry, status: 'done', response },
                next
              )
              return next
            })
          },
          onError: (error: any) => {
            setFileList(prev => {
              const next = prev.map(f =>
                f.uid === fileEntry.uid
                  ? { ...f, status: 'error', error }
                  : f
              )
              triggerChange({ ...fileEntry, status: 'error', error }, next)
              return next
            })
          },
          onProgress: (percent: number) => {
            setFileList(prev =>
              prev.map(f =>
                f.uid === fileEntry.uid ? { ...f, percent } : f
              )
            )
          }
        })
      }
    },
    [customRequest, triggerChange]
  )

  const handleInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      for (const file of files) {
        if (beforeUpload) {
          try {
            const result = await beforeUpload(file)
            if (result === false) continue
          } catch {
            continue
          }
        }
        processFile(file)
      }
      // Reset the input so the same file can be selected again
      if (inputRef.current) inputRef.current.value = ''
    },
    [beforeUpload, processFile]
  )

  const handleTriggerClick = useCallback(() => {
    if (disabled) return
    if (inputRef.current) inputRef.current.click()
  }, [disabled])

  const renderFileList = () => {
    if (!showUploadList || fileList.length === 0) return null

    if (listType === 'picture-card') {
      return (
        <PictureCardList>
          {fileList.map(f => (
            <PictureCardItem key={f.uid} $status={f.status}>
              {f.thumbUrl ? (
                <img src={f.thumbUrl} alt={f.name} />
              ) : (
                <FileName>{f.name}</FileName>
              )}
              <PictureCardRemove onClick={() => removeFile(f.uid)}>
                &#10005;
              </PictureCardRemove>
            </PictureCardItem>
          ))}
        </PictureCardList>
      )
    }

    return (
      <FileListWrapper>
        {fileList.map(f => (
          <FileItem key={f.uid} $status={f.status}>
            <FileName>{f.name}</FileName>
            <RemoveBtn onClick={() => removeFile(f.uid)}>&#10005;</RemoveBtn>
          </FileItem>
        ))}
      </FileListWrapper>
    )
  }

  const trigger =
    listType === 'picture-card' ? (
      <PictureCard $disabled={disabled} onClick={handleTriggerClick}>
        {children || '+'}
      </PictureCard>
    ) : (
      <TextTrigger $disabled={disabled} onClick={handleTriggerClick}>
        {children}
      </TextTrigger>
    )

  return (
    <Wrapper className={`ui-upload${className ? ` ${className}` : ''}`}>
      <HiddenInput
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        disabled={disabled}
      />
      {listType === 'picture-card' && renderFileList()}
      {trigger}
      {listType !== 'picture-card' && renderFileList()}
    </Wrapper>
  )
}

export default Upload
