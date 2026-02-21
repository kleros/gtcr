import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { Select, InputNumber, Slider, Tooltip } from 'components/ui'
import Icon from 'components/ui/icon'
import { ethers } from 'ethers'
import { PolicyRegistryABI as _PolicyRegistry } from 'utils/abis/policy-registry'
import { abi as _IArbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'
import ETHAmount from 'components/eth-amount'
import { jurorsAndCourtIDFromExtraData } from 'utils/string'
import useWindowDimensions from 'hooks/window-dimensions'
import useNativeCurrency from 'hooks/native-currency'
import {
  StyledExtraDataContainer,
  StyledInputContainer,
  StyledContainer,
  SliderContainer,
} from 'pages/factory/kleros-params'

interface Court {
  courtID: number
  name: string
  key: string
  value: string
  label: string
}

interface KlerosParamsProps {
  klerosAddress: string
  policyAddress: string
  setArbitratorExtraData: (val: string) => void
  arbitratorExtraData: string
  library: EthersLibrary | null
}

const KlerosParams = ({
  klerosAddress,
  policyAddress,
  setArbitratorExtraData,
  arbitratorExtraData,
  library,
}: KlerosParamsProps) => {
  const { width } = useWindowDimensions()
  const nativeCurrency = useNativeCurrency()
  const [arbitrationCost, setArbitrationCost] = useState(0)
  const [numberOfJurors, setNumberOfJurors] = useState(3)
  const [courtID, setCourtID] = useState<any>()
  const [courts, setCourts] = useState<Court[]>([])
  const policyRegistry = useMemo(() => {
    if (!policyAddress || !library) return
    try {
      return new ethers.Contract(policyAddress, _PolicyRegistry, library)
    } catch (err) {
      console.warn(
        `Failed to connect to policy registry at ${policyAddress}`,
        err,
      )
      return null
    }
  }, [library, policyAddress])

  const arbitrator = useMemo(() => {
    if (!klerosAddress || !library) return
    try {
      return new ethers.Contract(klerosAddress, _IArbitrator, library)
    } catch (err) {
      console.warn(`Failed to connect to kleros at ${klerosAddress}`, err)
      return null
    }
  }, [library, klerosAddress])

  // Fetch court data from policy registry.
  useEffect(() => {
    ;(async () => {
      if (!policyRegistry || !library) return
      setCourts([])
      try {
        const MAX_COURTS = 50
        const policyPaths = await Promise.all(
          Array.from({ length: MAX_COURTS }, (_, i) =>
            policyRegistry
              .policies(i)
              .then((path: string) => ({ courtID: i, path }))
              .catch(() => ({ courtID: i, path: '' })),
          ),
        )

        const fetchedCourts = policyPaths.filter(
          ({ path }) => path && path !== '',
        )
        if (fetchedCourts.length === 0) return

        setCourts(
          await Promise.all(
            fetchedCourts.map(async ({ courtID, path }) => {
              const URL = path.startsWith('/ipfs/')
                ? `${process.env.REACT_APP_IPFS_GATEWAY}${path}`
                : path
              try {
                const { name } = await (await fetch(URL)).json()
                return {
                  courtID,
                  name,
                  key: String(courtID),
                  value: String(courtID),
                  label: name,
                }
              } catch {
                return {
                  courtID,
                  name: `Court ${courtID}`,
                  key: String(courtID),
                  value: String(courtID),
                  label: `Court ${courtID}`,
                }
              }
            }),
          ),
        )
      } catch (err) {
        console.warn('Error fetching policies', err)
      }
    })()
  }, [library, policyRegistry])

  // Load arbitrator extra data
  useEffect(() => {
    const { courtID, numberOfJurors } =
      jurorsAndCourtIDFromExtraData(arbitratorExtraData)
    setCourtID(Number(courtID))
    setNumberOfJurors(Number(numberOfJurors))
  }, [arbitratorExtraData])

  // Display predicted arbitration cost.
  useEffect(() => {
    ;(async () => {
      if (!arbitratorExtraData || !arbitrator || !library) return
      setArbitrationCost(await arbitrator.arbitrationCost(arbitratorExtraData))
    })()
  }, [library, arbitrator, arbitratorExtraData])

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
    [numberOfJurors, setArbitratorExtraData],
  )

  const onNumJurorsChange = useCallback(
    (newNumJurors) => {
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
    [courtID, setArbitratorExtraData],
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
                ? String(courtID)
                : undefined
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

export default KlerosParams
