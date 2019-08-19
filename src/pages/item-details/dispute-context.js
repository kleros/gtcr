import React, { useState, useEffect, createContext, useMemo } from 'react'
import PropTypes from 'prop-types'
import { useWeb3Context } from 'web3-react'
import { abi as _arbitrator } from '../../assets/contracts/Arbitrator.json'
import { ethers } from 'ethers'
import BNPropType from '../../prop-types/bn'

const useDispute = (arbitratorAddress, disputeID, arbitratorExtraData) => {
  const { library, active } = useWeb3Context()
  const [appealCost, setAppealCost] = useState()
  const [errored, setErrored] = useState(false)

  // Setup arbitrator.
  const arbitrator = useMemo(() => {
    if (!library || !active || !arbitratorAddress) return
    return new ethers.Contract(arbitratorAddress, _arbitrator, library)
  }, [active, arbitratorAddress, library])

  // Fetch dispute data.
  useEffect(() => {
    if (
      !library ||
      !active ||
      !arbitrator ||
      disputeID == null ||
      !arbitratorExtraData
    )
      return
    ;(async () => {
      try {
        setAppealCost(
          await arbitrator.appealCost(disputeID, arbitratorExtraData)
        )
      } catch (err) {
        console.error(err)
        setErrored(true)
      }
    })()
  }, [active, arbitrator, arbitratorExtraData, disputeID, library])

  return { appealCost, errored }
}

const DisputeContext = createContext()
const DisputeProvider = ({
  children,
  arbitratorAddress,
  disputeID,
  arbitratorExtraData
}) => (
  <DisputeContext.Provider
    value={{ ...useDispute(arbitratorAddress, disputeID, arbitratorExtraData) }}
  >
    {children}
  </DisputeContext.Provider>
)

DisputeProvider.propTypes = {
  children: PropTypes.node.isRequired,
  arbitratorAddress: PropTypes.string,
  arbitratorExtraData: PropTypes.string,
  disputeID: BNPropType
}

DisputeProvider.defaultProps = {
  arbitratorAddress: '',
  disputeID: null,
  arbitratorExtraData: ''
}

export { DisputeContext, DisputeProvider }
