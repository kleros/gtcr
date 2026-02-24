import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  Children,
} from 'react'
import { createPortal } from 'react-dom'
import styled, { css, DefaultTheme } from 'styled-components'

const SelectWrapper = styled.div`
  display: inline-block;
`

const SelectTrigger = styled.div<{ $focused?: boolean; $disabled?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 32px;
  padding: 4px 11px;
  font-size: 14px;
  line-height: 1.5;
  color: ${({ theme }) => theme.textPrimary};
  background: ${({ theme }) => theme.componentBackground};
  border: 1px solid ${({ theme }) => theme.borderColor};
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
  box-sizing: border-box;
  user-select: none;

  &:hover {
    border-color: ${({ theme }) => theme.primaryColor};
  }

  ${({ $focused, theme }) =>
    $focused &&
    css`
      border-color: ${theme.primaryColor};
      box-shadow: 0 0 0 2px ${theme.focusShadowColor};
    `}

  ${({ $disabled, theme }) =>
    $disabled &&
    css`
      background: ${theme.elevatedBackground};
      color: ${theme.antdDisabledColor};
      cursor: not-allowed;

      &:hover {
        border-color: ${theme.borderColor};
      }
    `}
`

const SelectValue = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const Placeholder = styled.span`
  color: ${({ theme }) => theme.textTertiary};
`

const Arrow = styled.span<{ $open?: boolean }>`
  margin-left: 4px;
  font-size: 12px;
  color: ${({ theme }) => theme.textTertiary};
  transition: transform 0.3s;
  transform: ${({ $open }) => ($open ? 'rotate(180deg)' : 'rotate(0deg)')};
`

const DropdownStyled = styled.div`
  position: fixed;
  z-index: 1050;
  background: ${({ theme }) => theme.componentBackground};
  border: 1px solid ${({ theme }) => theme.borderColor};
  border-radius: 4px;
  box-shadow: ${({ theme }) => `0 4px 12px ${theme.shadowColor}`};
  max-height: 256px;
  overflow-y: auto;
  padding: 4px 0;
`

const SearchInput = styled.input`
  width: 100%;
  padding: 5px 12px;
  margin-bottom: 4px;
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.borderColor};
  background: ${({ theme }) => theme.componentBackground};
  color: ${({ theme }) => theme.textPrimary};
  font-size: 14px;
  outline: none;
  box-sizing: border-box;

  &::placeholder {
    color: ${({ theme }) => theme.textTertiary};
  }
`

const OptionItem = styled.div<{ $selected?: boolean; $disabled?: boolean }>`
  padding: 5px 12px;
  cursor: pointer;
  transition: background 0.3s;
  color: ${({ theme }) => theme.textPrimary};
  font-size: 14px;
  line-height: 22px;

  ${({ $selected, theme }) =>
    $selected &&
    css`
      background: ${theme.dropdownSelectedBg};
      font-weight: 600;
    `}

  ${({ $disabled, theme }) =>
    $disabled
      ? css`
          color: ${theme.antdDisabledColor};
          cursor: not-allowed;
        `
      : css`
          &:hover {
            background: ${({ theme: t }: { theme: DefaultTheme }) =>
              t.dropdownHoverBg};
          }
        `}
`

interface OptionProps {
  value: string | number
  disabled?: boolean
  children?: React.ReactNode
}

// Option sub-component (used mainly as a declarative API)
const Option: React.FC<OptionProps> = () => null
Option.displayName = 'Select.Option'

interface SelectProps {
  value?: string | number
  onChange?: (value: string | number) => void
  disabled?: boolean
  loading?: boolean
  labelInValue?: boolean
  style?: React.CSSProperties
  dropdownStyle?: React.CSSProperties
  defaultValue?: string | number
  placeholder?: string
  showSearch?: boolean
  children?: React.ReactNode
  className?: string
}

interface SelectComponent extends React.FC<SelectProps> {
  Option: React.FC<OptionProps>
}

const Select: SelectComponent = ({
  value,
  onChange,
  disabled = false,
  loading = false,
  labelInValue = false,
  style,
  dropdownStyle,
  defaultValue,
  placeholder,
  showSearch = false,
  children,
  className,
}) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedValue, setSelectedValue] = useState<
    string | number | undefined
  >(value !== undefined ? value : defaultValue)
  const triggerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [dropdownPos, setDropdownPos] = useState({
    top: 0,
    left: 0,
    width: 0,
  })

  // Sync controlled value
  useEffect(() => {
    if (value !== undefined) setSelectedValue(value)
  }, [value])

  // Parse options from children
  const options = useMemo(() => {
    const opts: {
      value: string | number
      label: React.ReactNode
      disabled?: boolean
    }[] = []
    Children.forEach(children, (child) => {
      const element = child as React.ReactElement
      if (!element || !element.props) return
      opts.push({
        value: element.props.value,
        label: element.props.children,
        disabled: element.props.disabled,
      })
    })
    return opts
  }, [children])

  // Filter options when searching
  const filteredOptions = useMemo(() => {
    if (!showSearch || !search) return options
    const lowerSearch = search.toLowerCase()
    return options.filter((opt) => {
      const label =
        typeof opt.label === 'string' ? opt.label : String(opt.value)
      return label.toLowerCase().includes(lowerSearch)
    })
  }, [options, search, showSearch])

  // Calculate dropdown position
  const updateDropdownPosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setDropdownPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    })
  }, [])

  // Click outside detection
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && showSearch && searchRef.current) searchRef.current.focus()
  }, [open, showSearch])

  const handleToggle = useCallback(() => {
    if (disabled || loading) return
    setOpen((prev) => {
      if (!prev) updateDropdownPosition()
      return !prev
    })
    setSearch('')
  }, [disabled, loading, updateDropdownPosition])

  const handleSelect = useCallback(
    (opt: {
      value: string | number
      label: React.ReactNode
      disabled?: boolean
    }) => {
      if (opt.disabled) return
      const newValue = opt.value
      setSelectedValue(newValue)
      setOpen(false)
      setSearch('')
      if (onChange)
        if (labelInValue)
          onChange({ key: newValue, label: opt.label } as unknown as
            | string
            | number)
        else onChange(newValue)
    },
    [onChange, labelInValue],
  )

  // Find display label for selected value
  const selectedLabel = useMemo(() => {
    const found = options.find((opt) => opt.value === selectedValue)
    return found ? found.label : selectedValue
  }, [selectedValue, options])

  const currentVal = selectedValue

  return (
    <SelectWrapper className={`ui-select${className ? ` ${className}` : ''}`}>
      <SelectTrigger
        ref={triggerRef}
        onClick={handleToggle}
        $focused={open}
        $disabled={disabled}
        style={style}
        className="ui-select-trigger"
      >
        <SelectValue>
          {currentVal !== undefined &&
          currentVal !== null &&
          currentVal !== '' ? (
            selectedLabel
          ) : (
            <Placeholder>{placeholder || '\u00A0'}</Placeholder>
          )}
        </SelectValue>
        <Arrow $open={open}>&#x25BC;</Arrow>
      </SelectTrigger>

      {open &&
        createPortal(
          <DropdownStyled
            ref={dropdownRef}
            style={{
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              ...dropdownStyle,
            }}
          >
            {showSearch && (
              <SearchInput
                ref={searchRef}
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSearch(e.target.value)
                }
                placeholder="Search..."
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              />
            )}
            {filteredOptions.length === 0 ? (
              <OptionItem
                style={{ cursor: 'default', textAlign: 'center' }}
                $disabled
              >
                No options
              </OptionItem>
            ) : (
              filteredOptions.map((opt) => (
                <OptionItem
                  key={opt.value}
                  $selected={opt.value === currentVal}
                  $disabled={opt.disabled}
                  onClick={() => handleSelect(opt)}
                >
                  {opt.label}
                </OptionItem>
              ))
            )}
          </DropdownStyled>,
          document.body,
        )}
    </SelectWrapper>
  )
}

Select.Option = Option

export default Select
