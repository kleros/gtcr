import React, { useState, useRef, useCallback } from 'react'
import styled, { css } from 'styled-components'
import { KitIcon } from './kit-icons'
import {
  ghostIconButton,
  joinClassNames,
  kitRadius,
  kitTransition,
  motionOk,
  ringSpinner,
} from './kit-styles'

const Wrapper = styled.div`
  display: block;
  margin: 8px 0;
`

/*
 * Drop target, v2: a raised well with a dashed hairline; on hover the line
 * turns blue, the fill takes a faint blue tint and the icon lifts.
 */
const PictureCard = styled.button<{ $disabled?: boolean }>`
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 112px;
  padding: 16px;
  border: 1px dashed var(--color-border-strong);
  border-radius: ${kitRadius.well};
  background: var(--color-raised);
  color: var(--color-muted);
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  transition: ${kitTransition('border-color', 'color', 'background')};

  > svg {
    transition: transform var(--dur-control) var(--ease-spring);
  }

  &:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--color-primary) 65%, transparent);
    background: color-mix(
      in srgb,
      var(--color-primary) 6%,
      var(--color-raised)
    );
    color: var(--color-text);
  }

  ${motionOk(css`
    &:hover:not(:disabled) > svg {
      transform: translateY(-2px);
    }
  `)}

  ${({ $disabled }) =>
    $disabled &&
    css`
      opacity: 0.55;
    `}
`

const TextTrigger = styled.span<{ $disabled?: boolean }>`
  display: inline-block;
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  ${({ $disabled }) =>
    $disabled &&
    css`
      opacity: 0.55;
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
  gap: 8px;
  min-height: 44px;
  padding: 0 8px 0 14px;
  margin-bottom: 6px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  background: var(--color-raised);
  color: var(--color-text);
  font-size: var(--fs-small);
  line-height: var(--lh-small);

  ${({ $status }) =>
    $status === 'error' &&
    css`
      border-color: color-mix(in srgb, var(--color-danger) 55%, transparent);
      color: var(--color-danger);
    `}
`

const FileIcon = styled.span`
  display: inline-flex;
  flex: 0 0 auto;
  color: var(--color-faint);
`

const FileName = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const FileSpinner = styled.span`
  ${ringSpinner}
  width: 14px;
  height: 14px;
  color: var(--color-primary);
`

const RemoveBtn = styled.button`
  ${ghostIconButton}
  width: 24px;
  height: 24px;

  &:hover:not(:disabled) {
    color: var(--color-danger);
  }
`

const PictureCardList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
`

const PictureCardItem = styled.div<{ $status?: string }>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 112px;
  height: 112px;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  border-radius: ${kitRadius.well};
  background: var(--color-raised);

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
        background: color-mix(in srgb, var(--color-surface) 70%, transparent);
      }
    `}

  ${({ $status }) =>
    $status === 'error' &&
    css`
      border-color: color-mix(in srgb, var(--color-danger) 55%, transparent);
    `}
`

const PictureCardRemove = styled.button`
  ${ghostIconButton}
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;
  width: 26px;
  height: 26px;
  border-color: var(--glass-border);
  background: var(--color-surface);

  &:hover:not(:disabled) {
    color: var(--color-danger);
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
  disabled = false,
}) => {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const isPictureCard = listType === 'picture-card'

  const triggerChange = useCallback(
    (file: UploadFile, list: UploadFile[]) => {
      if (onChange) onChange({ file, fileList: list })
    },
    [onChange],
  )

  const removeFile = useCallback(
    (fileUid: string) => {
      setFileList((prev) => {
        const next = prev.filter((f) => f.uid !== fileUid)
        const removed = prev.find((f) => f.uid === fileUid)
        if (removed) triggerChange({ ...removed, status: 'removed' }, next)
        return next
      })
    },
    [triggerChange],
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
            : null,
      }

      setFileList((prev) => {
        const next = [...prev, fileEntry]
        triggerChange(fileEntry, next)
        return next
      })

      if (customRequest)
        customRequest({
          file,
          onSuccess: (response: any) => {
            setFileList((prev) => {
              const next = prev.map((f) =>
                f.uid === fileEntry.uid
                  ? { ...f, status: 'done', response }
                  : f,
              )
              triggerChange({ ...fileEntry, status: 'done', response }, next)
              return next
            })
          },
          onError: (error: any) => {
            setFileList((prev) => {
              const next = prev.map((f) =>
                f.uid === fileEntry.uid ? { ...f, status: 'error', error } : f,
              )
              triggerChange({ ...fileEntry, status: 'error', error }, next)
              return next
            })
          },
          onProgress: (percent: number) => {
            setFileList((prev) =>
              prev.map((f) =>
                f.uid === fileEntry.uid ? { ...f, percent } : f,
              ),
            )
          },
        })
    },
    [customRequest, triggerChange],
  )

  const handleInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = [...(e.target.files || [])]
      for (const file of files) {
        if (beforeUpload)
          try {
            const result = await beforeUpload(file)
            if (result === false) continue
          } catch {
            continue
          }

        processFile(file)
      }
      // Reset the input so the same file can be selected again
      if (inputRef.current) inputRef.current.value = ''
    },
    [beforeUpload, processFile],
  )

  const handleTriggerClick = useCallback(() => {
    if (disabled) return
    if (inputRef.current) inputRef.current.click()
  }, [disabled])

  const renderFileList = () => {
    if (!showUploadList || fileList.length === 0) return null

    if (isPictureCard)
      return (
        <PictureCardList className="ui-upload-list ui-upload-list-picture-card">
          {fileList.map((f) => (
            <PictureCardItem
              key={f.uid}
              className="ui-upload-list-item"
              $status={f.status}
            >
              {f.thumbUrl ? (
                <img src={f.thumbUrl} alt={f.name} />
              ) : (
                <FileName>{f.name}</FileName>
              )}
              <PictureCardRemove
                type="button"
                onClick={() => removeFile(f.uid)}
                aria-label={`Remove ${f.name}`}
              >
                <KitIcon name="close" size={14} />
              </PictureCardRemove>
            </PictureCardItem>
          ))}
        </PictureCardList>
      )

    return (
      <FileListWrapper className="ui-upload-list ui-upload-list-text">
        {fileList.map((f) => (
          <FileItem
            key={f.uid}
            className="ui-upload-list-item"
            $status={f.status}
          >
            <FileIcon aria-hidden>
              <KitIcon name="file" size={14} />
            </FileIcon>
            <FileName>{f.name}</FileName>
            {f.status === 'uploading' && <FileSpinner aria-hidden />}
            <RemoveBtn
              type="button"
              onClick={() => removeFile(f.uid)}
              aria-label={`Remove ${f.name}`}
            >
              <KitIcon name="close" size={14} />
            </RemoveBtn>
          </FileItem>
        ))}
      </FileListWrapper>
    )
  }

  const trigger = isPictureCard ? (
    <PictureCard
      type="button"
      className="ui-upload-picture-card"
      $disabled={disabled}
      disabled={disabled}
      onClick={handleTriggerClick}
    >
      {children || <KitIcon name="upload" size={20} />}
    </PictureCard>
  ) : (
    <TextTrigger
      className="ui-upload-trigger"
      $disabled={disabled}
      onClick={handleTriggerClick}
    >
      {children}
    </TextTrigger>
  )

  return (
    <Wrapper
      className={joinClassNames(
        'ui-upload',
        isPictureCard && 'ui-upload-select-picture-card',
        disabled && 'ui-upload-disabled',
        className,
      )}
    >
      <HiddenInput
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        disabled={disabled}
      />
      {isPictureCard && renderFileList()}
      {trigger}
      {!isPictureCard && renderFileList()}
    </Wrapper>
  )
}

export default Upload
