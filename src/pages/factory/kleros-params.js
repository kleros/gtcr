import React, { useMemo, useState, useEffect } from 'react'
import styled from 'styled-components/macro'
import { Select, InputNumber } from 'antd'
import { ethers } from 'ethers'
import PropTypes from 'prop-types'
import { useWeb3Context } from 'web3-react'
import { abi as _PolicyRegistry } from '@kleros/kleros/build/contracts/PolicyRegistry.json'
import { abi as _IArbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'
import ETHAmount from '../../components/eth-amount'

const StyledExtraDataContainer = styled.div`
  padding-bottom: 8px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
`

const StyledInputContainer = styled.div`
  display: flex;
  flex-direction: column;
`

const StyledContainer = styled.div`
  display: flex;
`

const KlerosParams = ({
  klerosAddress,
  policyAddress,
  setArbitratorExtraData,
  arbitratorExtraData
}) => {
  const { library, active } = useWeb3Context()
  const [arbitrationCost, setArbitrationCost] = useState(0)
  const [numberOfJurors, setNumberOfJurors] = useState(1)
  const [courtID, setCourtID] = useState(0)
  const [courts, setCourts] = useState([])

  const policyRegistry = useMemo(() => {
    if (!policyAddress || !active) return
    try {
      return new ethers.Contract(policyAddress, _PolicyRegistry, library)
    } catch (err) {
      console.warn(
        `Failed to connect to policy registry at ${policyAddress}`,
        err
      )
      return null
    }
  }, [active, library, policyAddress])

  const arbitrator = useMemo(() => {
    if (!klerosAddress || !active) return
    try {
      return new ethers.Contract(klerosAddress, _IArbitrator, library)
    } catch (err) {
      console.warn(`Failed to connect to kleros at ${klerosAddress}`, err)
      return null
    }
  }, [active, klerosAddress, library])

  // Fetch court data from policy registry.
  useEffect(() => {
    ;(async () => {
      if (!policyRegistry || !active) return
      try {
        const logs = (
          await library.getLogs({
            ...policyRegistry.filters.PolicyUpdate(),
            fromBlock: 0
          })
        )
          .reverse()
          .map(log => ({
            ...policyRegistry.interface.parseLog(log).values,
            blockNumber: log.blockNumber
          }))
        if (logs.length === 0) throw new Error('No policy event emitted.')

        // Take the most recent events for each court.
        const latest = {}
        logs.forEach(({ _subcourtID, _policy }) => {
          latest[_subcourtID.toString()] = _policy
        }, [])

        // The latest version of the contract contains a bug which emits the previous
        // policy instead of the most recent one. So we have query the contract directly
        // for each court :(
        setCourts(
          await Promise.all(
            Object.keys(latest).map(async courtID => {
              const path = await policyRegistry.policies(courtID)
              const URL = path.startsWith('/ipfs/')
                ? `${process.env.REACT_APP_IPFS_GATEWAY}${path}`
                : path
              const { name } = await (await fetch(URL)).json()
              return { courtID, name }
            })
          )
        )
      } catch (err) {
        console.warn('Error fetching policies', err)
      }
    })()
  }, [active, courtID, library, policyRegistry])

  // Set arbitrator extra data.
  useEffect(() => {
    setArbitratorExtraData(
      `0x${courtID.toString(16).padStart(64, '0')}${Math.ceil(numberOfJurors)
        .toString(16)
        .padStart(64, '0')}`
    )
  }, [courtID, numberOfJurors, setArbitratorExtraData])

  // Display predicted arbitration cost.
  useEffect(() => {
    ;(async () => {
      if (!arbitratorExtraData || !arbitrator || !active) return
      setArbitrationCost(await arbitrator.arbitrationCost(arbitratorExtraData))
    })()
  }, [active, arbitrator, arbitratorExtraData])

  return (
    <StyledExtraDataContainer>
      <StyledContainer>
        <StyledInputContainer>
          <span>Court:</span>
          <Select
            defaultValue="Select"
            style={{ width: 120 }}
            onChange={setCourtID}
            loading={courts.length === 0}
            disabled={courts.length === 0}
          >
            {courts.map(({ courtID, name }) => (
              <Select.Option value={courtID} key={courtID}>
                {name}
              </Select.Option>
            ))}
          </Select>
        </StyledInputContainer>
        <StyledInputContainer style={{ marginLeft: '24px' }}>
          <span>Number of Jurors:</span>
          <InputNumber min={1} defaultValue={1} onChange={setNumberOfJurors} />
        </StyledInputContainer>
      </StyledContainer>
      Arbitration Cost:{' '}
      <ETHAmount displayUnit decimals={4} amount={arbitrationCost} step="1" />
    </StyledExtraDataContainer>
  )
}

KlerosParams.propTypes = {
  klerosAddress: PropTypes.string.isRequired,
  policyAddress: PropTypes.string.isRequired,
  setArbitratorExtraData: PropTypes.func.isRequired,
  arbitratorExtraData: PropTypes.string.isRequired
}

export default KlerosParams
