import React, { createContext, useContext, useId, useLayoutEffect } from 'react'

/*
 * Form.Item hands its label, help line and status to the controls inside it
 * through this context, so a field is named and described without cloning
 * its children. The first unnamed control to mount takes the label's
 * `htmlFor`. Any other control is named by the label through
 * `aria-labelledby`, followed by its own `aria-label` when it has one.
 */
export interface FormItemContextValue {
  /** The id of the item's <label>, when it has one. */
  labelId?: string
  /** The control the <label> points at. */
  labelFor?: string
  /** The id of the help line, while one is shown. */
  helpId?: string
  invalid: boolean
  register: (controlId: string) => () => void
}

export const FormItemContext = createContext<FormItemContextValue | null>(null)

export interface ControlA11yProps {
  id?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-invalid'?: React.AriaAttributes['aria-invalid']
}

const joinIds = (...ids: (string | undefined)[]) =>
  ids.filter(Boolean).join(' ') || undefined

/** The id and ARIA wiring for a kit control; explicit props always win. */
export const useFormItemControl = (props: ControlA11yProps) => {
  const item = useContext(FormItemContext)
  const ownId = useId()
  const id = props.id ?? (item ? ownId : undefined)
  const ariaLabel = props['aria-label']
  const ariaLabelledby = props['aria-labelledby']
  const named = Boolean(ariaLabel || ariaLabelledby)
  const register = item?.labelId && !named ? item.register : undefined

  useLayoutEffect(() => {
    if (!register || !id) return undefined
    return register(id)
  }, [register, id])

  const labelledby =
    ariaLabelledby ??
    (item?.labelId && item.labelFor !== id
      ? joinIds(item.labelId, ariaLabel ? id : undefined)
      : undefined)

  return {
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': labelledby,
    'aria-describedby': joinIds(props['aria-describedby'], item?.helpId),
    'aria-invalid': props['aria-invalid'] ?? (item?.invalid || undefined),
  }
}
