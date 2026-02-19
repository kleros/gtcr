import React, { useMemo, useState, useEffect, useCallback } from 'react'
import styled from 'styled-components'
import { Select, InputNumber, Slider, Tooltip, Icon } from 'antd'
import { ethers } from 'ethers'
import PropTypes from 'prop-types'
import { useWeb3Context } from 'web3-react'
import { abi as _PolicyRegistry } from '@kleros/kleros/build/contracts/PolicyRegistry.json'
import { abi as _IArbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'
import ETHAmount from 'components/eth-amount'
import { jurorsAndCourtIDFromExtraData } from 'utils/string'
import useWindowDimensions from 'hooks/window-dimensions'
import useNativeCurrency from 'hooks/native-currency'

export const StyledExtraDataContainer = styled.div`
  padding-bottom: 8px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  color: ${({ theme }) => theme.textPrimary};
`

export const StyledInputContainer = styled.div`
  display: flex;
  flex-direction: column;

  span,
  label {
    color: ${({ theme }) => theme.textPrimary};
  }
`

export const StyledContainer = styled.div`
  display: flex;
  margin-bottom: 24px;
  flex: 1;
`

export const SliderContainer = styled.div`
  display: flex;
  align-items: center;
`

const KlerosParams = ({
  klerosAddress,
  policyAddress,
  setArbitratorExtraData,
  arbitratorExtraData
}) => {
  const { width } = useWindowDimensions()
  const nativeCurrency = useNativeCurrency()
  const { library, active } = useWeb3Context()
  const [arbitrationCost, setArbitrationCost] = useState(0)
  const [numberOfJurors, setNumberOfJurors] = useState(3)
  const [courtID, setCourtID] = useState()
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
      setCourts([])
      try {
        // Query policies directly for court IDs 0-29 instead of scanning
        // logs from block 0, which causes RPC timeouts on long chains.
        const MAX_COURTS = 30
        const policyPaths = await Promise.all(
          Array.from({ length: MAX_COURTS }, (_, i) =>
            policyRegistry.policies(i).catch(() => '')
          )
        )

        const courtsWithPolicies = policyPaths
          .map((path, courtID) => ({ courtID, path }))
          .filter(({ path }) => path && path !== '')

        if (courtsWithPolicies.length === 0) return

        const fetchedCourts = await Promise.all(
          courtsWithPolicies.map(async ({ courtID, path }) => {
            try {
              const url = path.startsWith('/ipfs/')
                ? `${process.env.REACT_APP_IPFS_GATEWAY}${path}`
                : path
              const { name } = await (await fetch(url)).json()
              return {
                courtID,
                name,
                key: String(courtID),
                value: String(courtID),
                label: name
              }
            } catch {
              return {
                courtID,
                name: `Court ${courtID}`,
                key: String(courtID),
                value: String(courtID),
                label: `Court ${courtID}`
              }
            }
          })
        )

        setCourts(fetchedCourts)
      } catch (err) {
        console.warn('Error fetching policies', err)
      }
    })()
  }, [active, policyRegistry])

  // Load arbitrator extra data
  useEffect(() => {
    const { courtID, numberOfJurors } = jurorsAndCourtIDFromExtraData(
      arbitratorExtraData
    )
    setCourtID(Number(courtID))
    setNumberOfJurors(Number(numberOfJurors))
  }, [arbitratorExtraData])

  // Display predicted arbitration cost.
  useEffect(() => {
    ;(async () => {
      if (!arbitratorExtraData || !arbitrator || !active) return
      setArbitrationCost(await arbitrator.arbitrationCost(arbitratorExtraData))
    })()
  }, [active, arbitrator, arbitratorExtraData])

  const onCourtChanged = useCallback(
    ({ key: newCourtID }) => {
      if (isNaN(newCourtID)) return

      const newArbitratorExtraData = `0x${Number(newCourtID)
        .toString(16)
        .padStart(64, '0')}${Math.ceil(numberOfJurors)
        .toString(16)
        .padStart(64, '0')}`

      setArbitratorExtraData(newArbitratorExtraData)
      setCourtID(Number(newCourtID))
    },
    [numberOfJurors, setArbitratorExtraData]
  )

  const onNumJurorsChange = useCallback(
    newNumJurors => {
      if (isNaN(newNumJurors)) return
      newNumJurors = newNumJurors > 0 ? newNumJurors : 1
      newNumJurors = newNumJurors < 35 ? newNumJurors : 33
      if (newNumJurors % 2 === 0) newNumJurors = newNumJurors - 1

      const newArbitratorExtraData = `0x${courtID
        .toString(16)
        .padStart(64, '0')}${Math.ceil(newNumJurors)
        .toString(16)
        .padStart(64, '0')}`
      setArbitratorExtraData(newArbitratorExtraData)
      setNumberOfJurors(newNumJurors)
    },
    [courtID, setArbitratorExtraData]
  )

  return (
    <StyledExtraDataContainer>
      <StyledContainer>
        <StyledInputContainer>
          <span>Court:</span>
          <Select
            style={{ width: 120 }}
            dropdownStyle={{ minWidth: 250 }}
            onChange={onCourtChanged}
            loading={courts.length === 0 || typeof courtID !== 'number'}
            disabled={courts.length === 0 || typeof courtID !== 'number'}
            labelInValue
            value={
              courts && courts.length > 0 && typeof courtID === 'number'
                ? courts.find(court => courtID === court.courtID)
                : { key: 0, label: 'General Court' }
            }
          >
            {courts.map(({ value, label }) => (
              <Select.Option value={value} key={value}>
                {label}
              </Select.Option>
            ))}
          </Select>
        </StyledInputContainer>
        <StyledInputContainer style={{ flex: 1, margin: '0 12px' }}>
          <label htmlFor="depositSlider">
            Number of Jurors&nbsp;
            <Tooltip title="This determines how many jurors will be drawn in the first round of any eventual disputes involving your list. In general, a standard number is 3. In cases where the decision is straightforward and not much effort is required, one juror might be sufficient. In situations where significant effort is required to review the case, it can be better to require more jurors. However, if you set a higher number of initial jurors, this will result in larger deposits being required by users which may result in a lower amount of submissions.">
              <Icon type="question-circle-o" />
            </Tooltip>
            :
          </label>
          <SliderContainer>
            {width > 480 && (
              <Slider
                id="numJurors"
                min={1}
                max={33}
                onChange={onNumJurorsChange}
                value={Number(numberOfJurors)}
                step={2}
                style={{ flex: 1, marginRight: '24px' }}
              />
            )}
            <InputNumber
              value={Number(numberOfJurors)}
              min={1}
              max={33}
              defaultValue={3}
              onChange={onNumJurorsChange}
            />
          </SliderContainer>
        </StyledInputContainer>
      </StyledContainer>
      Arbitration Cost:{' '}
      <ETHAmount
        displayUnit={` ${nativeCurrency}`}
        decimals={4}
        amount={arbitrationCost}
        step="1"
      />
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
