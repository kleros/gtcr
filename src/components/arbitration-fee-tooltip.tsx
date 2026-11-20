import React from 'react'
import { Tooltip } from 'components/ui'
import Icon from 'components/ui/Icon'

export const ARBITRATION_FEE_TOOLTIP =
  'Arbitration fees are paid up front to open or continue a dispute. They are reimbursed to the side that wins, so parties acting in good faith should not ultimately bear them.'

const ArbitrationFeeTooltip = () => (
  <Tooltip title={ARBITRATION_FEE_TOOLTIP}>
    <Icon type="question-circle-o" />
  </Tooltip>
)

export const ArbitrationFeeLabel = ({
  children = 'Arbitration fee',
}: {
  children?: React.ReactNode
}) => (
  <>
    {children}
    &nbsp;
    <ArbitrationFeeTooltip />
  </>
)

export default ArbitrationFeeTooltip
