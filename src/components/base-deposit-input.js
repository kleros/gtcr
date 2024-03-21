import { Form, Input, Tooltip, Icon } from 'antd'
import { Field } from 'formik'
import React, { useMemo } from 'react'
import PropTypes from 'prop-types'
import { bigNumberify, parseEther } from 'ethers/utils'
import styled from 'styled-components'
import BNPropType from '../prop-types/bn'
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

const BaseDepositInput = ({
  label,
  name,
  error,
  touched,
  hasFeedback,
  disabled,
  arbitrationCost,
  values
}) => {
  const baseDeposit = useMemo(() => {
    try {
      return bigNumberify(parseEther(values[name].toString()))
    } catch (err) {
      console.warn('failed to parse basedeposit value', err)
      // No op. Wait for proper user input.
    }
  }, [name, values])
  const nativeCurrency = useNativeCurrency()

  const totalDeposit = useMemo(
    () => baseDeposit && arbitrationCost && baseDeposit.add(arbitrationCost),
    [arbitrationCost, baseDeposit]
  )

  return (
    <div>
      <Field name={name}>
        {({ field }) => (
          <Form.Item
            label={label}
            validateStatus={error && touched ? 'error' : undefined}
            help={error && touched ? error : ''}
            hasFeedback={hasFeedback}
          >
            <BasedDepositContainer>
              <Input
                addonAfter={nativeCurrency}
                placeholder="0.1"
                step={0.0001}
                disabled={disabled}
                {...field}
              />
              <TotalCostContainer>
                Total&nbsp;
                <Tooltip title="The total cost is the sum of the base deposit and the arbitration cost.">
                  <Icon type="question-circle-o" />
                </Tooltip>
                :{' '}
                <ETHAmount
                  amount={totalDeposit}
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

BaseDepositInput.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  error: PropTypes.string,
  touched: PropTypes.bool,
  hasFeedback: PropTypes.bool,
  step: PropTypes.number,
  disabled: PropTypes.bool,
  arbitrationCost: BNPropType,
  values: PropTypes.oneOfType([
    PropTypes.shape({
      submissionBaseDeposit: PropTypes.number.isRequired,
      removalBaseDeposit: PropTypes.number.isRequired,
      submissionChallengeBaseDeposit: PropTypes.number.isRequired,
      removalChallengeBaseDeposit: PropTypes.number.isRequired
    }).isRequired,
    PropTypes.shape({
      relSubmissionBaseDeposit: PropTypes.number.isRequired,
      relRemovalBaseDeposit: PropTypes.number.isRequired,
      relSubmissionChallengeBaseDeposit: PropTypes.number.isRequired,
      relRemovalChallengeBaseDeposit: PropTypes.number.isRequired
    }).isRequired
  ]).isRequired
}

BaseDepositInput.defaultProps = {
  label: null,
  error: null,
  touched: null,
  hasFeedback: null,
  step: null,
  disabled: null,
  arbitrationCost: null
}

export default BaseDepositInput
