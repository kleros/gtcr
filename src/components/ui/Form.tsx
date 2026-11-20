import React, { useCallback, useId, useMemo, useState } from 'react'
import styled, { css } from 'styled-components'
import { FormItemContext } from './form-item-context'
import { joinClassNames, kitType } from './kit-styles'

const StyledForm = styled.form<{ $layout?: string }>`
  ${({ $layout }) =>
    $layout === 'horizontal' &&
    css`
      .ui-form-item {
        flex-direction: row;
        align-items: center;
        gap: 12px;
      }
      .ui-form-item-label {
        flex: 0 0 auto;
        min-width: 96px;
        margin-bottom: 0;
        text-align: right;
      }
      .ui-form-item-control {
        flex: 1;
        min-width: 0;
      }
    `}
`

/*
 * Field block, v2: a 12/500 label above the field, the control, then one help
 * line. An error tints the field's hairline in the danger role (full colour
 * plus a 1px ring and a soft halo on focus) and the help line names the
 * problem; success does the same in the registered role.
 *
 * A bare input inside an addon group is not the field: its group carries
 * the border, so those inputs are left out here.
 */
const bareInput = ':is(input, textarea):not(.ui-input-group *)'

const statusField = (color: string) => css`
  .ui-form-item-control ${bareInput}, .ui-form-item-control .ui-select-trigger {
    border-color: color-mix(in srgb, ${color} 60%, transparent) !important;
  }

  &&
    .ui-form-item-control
    ${bareInput}.ui-input.ui-input,
    &&
    .ui-form-item-control
    .ui-input-group,
  && .ui-form-item-control .ui-select-trigger {
    border-color: color-mix(in srgb, ${color} 60%, transparent) !important;
  }

  &&
    .ui-form-item-control
    ${bareInput}.ui-input.ui-input:focus,
    &&
    .ui-form-item-control
    .ui-input-group:focus-within,
  && .ui-form-item-control .ui-select-trigger[aria-expanded='true'] {
    border-color: ${color} !important;
    box-shadow:
      0 0 0 1px ${color},
      0 0 0 5px color-mix(in srgb, ${color} 16%, transparent) !important;
  }
`

const FormItemWrapper = styled.div<{ $validateStatus?: string }>`
  display: flex;
  flex-direction: column;
  margin-bottom: 18px;

  /* Outside a horizontal kit form the label sits above: no colon. */
  .ui-form-item-colon {
    display: none;
  }

  .ui-form-horizontal & .ui-form-item-colon {
    display: inline;
  }

  ${({ $validateStatus }) =>
    $validateStatus === 'error' && statusField('var(--color-danger)')}

  ${({ $validateStatus }) =>
    $validateStatus === 'success' && statusField('var(--color-success)')}
`

/*
 * The label is one run of text, so a long one wraps naturally. A label above
 * its field needs no colon (sentence case, no punctuation); the colon shows
 * only beside the field in a horizontal form. The field name is in text
 * colour; a description inside it is muted by the caller.
 */
const Label = styled.label<{ $required?: boolean }>`
  display: block;
  margin-bottom: 8px;
  color: var(--color-text);
  font-size: ${kitType.meta};
  line-height: ${kitType.metaLine};
  font-weight: 500;
  letter-spacing: 0.01em;

  ${({ $required }) =>
    $required &&
    css`
      &::before {
        content: '*';
        margin-right: 4px;
        color: var(--color-danger);
      }
    `}
`

const HelpText = styled.div<{ $isError?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-height: var(--lh-small);
  margin-top: 6px;
  color: ${({ $isError }) =>
    $isError ? 'var(--color-danger)' : 'var(--color-faint)'};
  font-size: ${kitType.meta};
  line-height: ${kitType.metaLine};
  transition: color var(--dur-hover) var(--ease-out);
`

const ControlWrapper = styled.div`
  position: relative;
  min-width: 0;
`

interface FormProps {
  onSubmit?: React.FormEventHandler<HTMLFormElement>
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

const Form: FormComponent = ({
  onSubmit,
  id,
  layout = 'vertical',
  style,
  className,
  children,
}) => {
  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault()
    onSubmit && onSubmit(e)
  }

  return (
    <StyledForm
      onSubmit={handleSubmit}
      id={id}
      $layout={layout}
      style={style}
      className={joinClassNames('ui-form', `ui-form-${layout}`, className)}
    >
      {children}
    </StyledForm>
  )
}

const FormItem: React.FC<FormItemProps> = ({
  label,
  validateStatus,
  help,
  style,
  className,
  children,
  colon = true,
  required = false,
}) => {
  const baseId = useId()
  const labelId = label ? `${baseId}-label` : undefined
  const helpId = help ? `${baseId}-help` : undefined
  const invalid = validateStatus === 'error'

  // Controls register in mount order; the first one takes the label's `for`.
  const [controls, setControls] = useState<string[]>([])
  const register = useCallback((controlId: string) => {
    setControls((previous) =>
      previous.includes(controlId) ? previous : [...previous, controlId],
    )
    return () =>
      setControls((previous) => previous.filter((id) => id !== controlId))
  }, [])
  const labelFor = controls[0]

  const context = useMemo(
    () => ({ labelId, labelFor, helpId, invalid, register }),
    [labelId, labelFor, helpId, invalid, register],
  )

  return (
    <FormItemWrapper
      $validateStatus={validateStatus}
      style={style}
      className={joinClassNames(
        'ui-form-item',
        validateStatus && `ui-form-item-${validateStatus}`,
        className,
      )}
    >
      {label && (
        <Label
          id={labelId}
          htmlFor={labelFor}
          className="ui-form-item-label"
          $required={required}
        >
          {label}
          {colon && (
            <span className="ui-form-item-colon" aria-hidden="true">
              :
            </span>
          )}
        </Label>
      )}
      <ControlWrapper className="ui-form-item-control">
        <FormItemContext.Provider value={context}>
          {children}
        </FormItemContext.Provider>
      </ControlWrapper>
      {help && (
        <HelpText
          id={helpId}
          className={joinClassNames(
            'ui-form-item-help',
            invalid && 'ui-form-item-error',
          )}
          $isError={invalid}
          aria-live="polite"
        >
          {help}
        </HelpText>
      )}
    </FormItemWrapper>
  )
}

FormItem.displayName = 'Form.Item'

Form.Item = FormItem

export default Form
