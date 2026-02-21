import React, { useMemo } from 'react'
import styled from 'styled-components'
import { Form, Input, Tooltip } from 'components/ui'
import Icon from 'components/ui/icon'
import { ethers, BigNumber } from 'ethers'

const { parseEther } = ethers.utils
import { Field } from 'formik'
import ETHAmount from './eth-amount'
import useNativeCurrency from '../hooks/native-currency'

const BasedDepositContainer = styled.div`
  display: flex;
  align-items: center;
`
const TotalCostContainer = styled.span`
  min-width: 15%;
  text-align: center;
`

interface BaseDepositInputProps {
  label?: string | React.ReactNode | null
  name: string
  error?: string | null
  touched?: boolean | null
  hasFeedback?: boolean | null
  disabled?: boolean | null
  arbitrationCost?: BigNumber
  values: Record<string, unknown>
}

const BaseDepositInput = ({
  label,
  name,
  error,
  touched,
  hasFeedback,
  disabled,
  arbitrationCost,
  values,
}: BaseDepositInputProps) => {
  const baseDeposit = useMemo(() => {
    try {
      return BigNumber.from(parseEther(String(values[name])))
    } catch (err) {
      console.warn('failed to parse basedeposit value', err)
      // No op. Wait for proper user input.
    }
  }, [name, values])
  const nativeCurrency = useNativeCurrency()

  const totalDeposit = useMemo(
    () => baseDeposit && arbitrationCost && baseDeposit.add(arbitrationCost),
    [arbitrationCost, baseDeposit],
  )

  return (
    <div>
      <Field name={name}>
        {({ field }: { field: Record<string, unknown> }) => (
          <Form.Item
            label={label}
            validateStatus={error && touched ? 'error' : undefined}
            help={error && touched ? error : ''}
            hasFeedback={hasFeedback ?? undefined}
          >
            <BasedDepositContainer>
              <Input
                addonAfter={nativeCurrency}
                placeholder="0.1"
                step={0.0001}
                disabled={disabled ?? undefined}
                {...field}
              />
              <TotalCostContainer>
                Total&nbsp;
                <Tooltip title="The total cost is the sum of the base deposit and the arbitration cost.">
                  <Icon type="question-circle-o" />
                </Tooltip>
                :{' '}
                <ETHAmount
                  amount={totalDeposit!}
                  decimals={3}
                  displayUnit={` ${nativeCurrency}`}
                />
              </TotalCostContainer>
            </BasedDepositContainer>
          </Form.Item>
        )}
      </Field>
    </div>
  )
}

export default BaseDepositInput
