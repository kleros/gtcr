import React from 'react'
import styled, { css } from 'styled-components'

const StyledForm = styled.form<{ $layout?: string }>`
  ${({ $layout }) =>
    $layout === 'horizontal' &&
    css`
      .ui-form-item {
        flex-direction: row;
        align-items: center;
      }
      .ui-form-item-label {
        flex: 0 0 auto;
        margin-right: 8px;
        margin-bottom: 0;
        min-width: 80px;
        text-align: right;
      }
      .ui-form-item-control {
        flex: 1;
      }
    `}
`

const FormItemWrapper = styled.div<{ $validateStatus?: string }>`
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;

  ${({ $validateStatus, theme }) =>
    $validateStatus === 'error' &&
    css`
      .ui-form-item-control input,
      .ui-form-item-control textarea,
      .ui-form-item-control .ui-select-trigger {
        border-color: ${theme.errorColor} !important;
      }
    `}

  ${({ $validateStatus, theme }) =>
    $validateStatus === 'success' &&
    css`
      .ui-form-item-control input,
      .ui-form-item-control textarea,
      .ui-form-item-control .ui-select-trigger {
        border-color: ${theme.successColor} !important;
      }
    `}
`

const Label = styled.label<{ $required?: boolean }>`
  color: ${({ theme }) => theme.textPrimary};
  font-size: 14px;
  margin-bottom: 8px;
  line-height: 1.5;

  ${({ $required }) =>
    $required &&
    css`
      &::before {
        content: '* ';
        color: ${({ theme }) => theme.errorColor};
      }
    `}
`

const HelpText = styled.div<{ $isError?: boolean }>`
  font-size: 12px;
  min-height: 22px;
  line-height: 1.5;
  padding-top: 2px;
  color: ${({ $isError, theme }) =>
    $isError ? theme.errorColor : theme.textSecondary};
  transition: color 0.3s;
`

const ControlWrapper = styled.div`
  position: relative;
`

interface FormProps {
  onSubmit?: (e: React.FormEvent) => void
  id?: string
  layout?: string
  style?: React.CSSProperties
  className?: string
  children?: React.ReactNode
}

interface FormItemProps {
  label?: React.ReactNode
  validateStatus?: string
  help?: React.ReactNode
  hasFeedback?: boolean
  name?: string
  style?: React.CSSProperties
  className?: string
  children?: React.ReactNode
  colon?: boolean
  required?: boolean
}

interface FormComponent extends React.FC<FormProps> {
  Item: React.FC<FormItemProps>
}

const Form: FormComponent = ({ onSubmit, id, layout = 'vertical', style, className, children }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit && onSubmit(e)
  }

  return (
    <StyledForm
      onSubmit={handleSubmit}
      id={id}
      $layout={layout}
      style={style}
      className={`ui-form${className ? ` ${className}` : ''}`}
    >
      {children}
    </StyledForm>
  )
}

const FormItem: React.FC<FormItemProps> = ({
  label,
  validateStatus,
  help,
  hasFeedback,
  name,
  style,
  className,
  children,
  colon = true,
  required = false
}) => (
  <FormItemWrapper
    $validateStatus={validateStatus}
    style={style}
    className={`ui-form-item${className ? ` ${className}` : ''}`}
  >
    {label && (
      <Label className="ui-form-item-label" $required={required}>
        {label}
        {colon && ':'}
      </Label>
    )}
    <ControlWrapper className="ui-form-item-control">{children}</ControlWrapper>
    {help && (
      <HelpText $isError={validateStatus === 'error'}>{help}</HelpText>
    )}
  </FormItemWrapper>
)

FormItem.displayName = 'Form.Item'

Form.Item = FormItem

export default Form
