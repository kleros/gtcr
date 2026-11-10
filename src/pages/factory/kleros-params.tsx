import React, { useMemo, useState, useEffect, useCallback, useId } from 'react'
import styled from 'styled-components'
import { ethers, type BigNumber } from 'ethers'
import { abi as _IArbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'
import { jurorsAndCourtIDFromExtraData } from 'utils/string'
import useNativeCurrency from 'hooks/native-currency'
import useCourtPolicies from 'hooks/use-court-policies'
import { AnimatedNumber } from 'components/curate/motion/animated-number'
import {
  Label,
  Row,
  SkeletonBlock,
  Small,
  Stack,
} from 'components/curate/primitives'
import {
  FieldGrid,
  FormField,
  Input,
  RangeInput,
  Select,
  amountFormat,
  formatNative,
} from './fields'

/*
 * Court and number of jurors for a Kleros arbitrator, encoded into the
 * arbitrator extra data, with the resulting arbitration cost read from the
 * arbitrator contract. Used by the list step and the badges step.
 */

const JurorsInput = styled(Input)`
  flex: 0 0 auto;
  width: 64px;
  text-align: center;
  font-family: var(--font-figure);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
`

/** The cost read-out: one figure, its unit and one line on who pays it. */
const CostLine = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px 16px;
  padding: 14px 16px;
  border-radius: var(--radius);
  background: var(--color-raised);
`

const CostFigure = styled.span`
  color: var(--color-text);
  font-family: var(--font-figure);
  font-size: 22px;
  line-height: 26px;
  font-weight: 500;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;

  small {
    margin-left: 6px;
    color: var(--color-muted);
    font-size: var(--fs-small);
    font-weight: 500;
    letter-spacing: 0;
  }
`

const MIN_JURORS = 1
const MAX_JURORS = 33

const encodeExtraData = (courtID: number, numberOfJurors: number) =>
  `0x${courtID.toString(16).padStart(64, '0')}${Math.ceil(numberOfJurors)
    .toString(16)
    .padStart(64, '0')}`

interface KlerosParamsProps {
  klerosAddress?: string
  policyAddress?: string
  setArbitratorExtraData: (val: string) => void
  arbitratorExtraData?: string
  library?: EthersLibrary | null
}

const KlerosParams = ({
  klerosAddress,
  policyAddress,
  setArbitratorExtraData,
  arbitratorExtraData,
  library,
}: KlerosParamsProps) => {
  const ids = useId()
  const nativeCurrency = useNativeCurrency()
  const [arbitrationCost, setArbitrationCost] = useState<BigNumber>()
  const [numberOfJurors, setNumberOfJurors] = useState(3)
  const [courtID, setCourtID] = useState<number>()
  const { data: courts = [] } = useCourtPolicies(policyAddress, library)

  const arbitrator = useMemo(() => {
    if (!klerosAddress || !library) return
    try {
      return new ethers.Contract(klerosAddress, _IArbitrator, library)
    } catch (err) {
      console.warn(`Failed to connect to kleros at ${klerosAddress}`, err)
      return null
    }
  }, [library, klerosAddress])

  // Load arbitrator extra data
  useEffect(() => {
    if (!arbitratorExtraData) return
    const parsed = jurorsAndCourtIDFromExtraData(arbitratorExtraData)
    setCourtID(Number(parsed.courtID))
    setNumberOfJurors(Number(parsed.numberOfJurors))
  }, [arbitratorExtraData])

  // Display predicted arbitration fee.
  useEffect(() => {
    let cancelled = false
    setArbitrationCost(undefined)
    ;(async () => {
      if (!arbitratorExtraData || !arbitrator || !library) return
      try {
        const cost = await arbitrator.arbitrationCost(arbitratorExtraData)
        if (!cancelled) setArbitrationCost(cost)
      } catch (err) {
        console.warn('Failed to read the arbitration cost', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [library, arbitrator, arbitratorExtraData])

  const onCourtChanged = useCallback(
    (value: string) => {
      const newCourtID = Number(value)
      if (Number.isNaN(newCourtID)) return
      setArbitratorExtraData(encodeExtraData(newCourtID, numberOfJurors))
      setCourtID(newCourtID)
    },
    [numberOfJurors, setArbitratorExtraData],
  )

  const onNumJurorsChange = useCallback(
    (value: number) => {
      if (Number.isNaN(value)) return
      let newNumJurors = value > 0 ? value : MIN_JURORS
      newNumJurors = newNumJurors < 35 ? newNumJurors : MAX_JURORS
      if (newNumJurors % 2 === 0) newNumJurors = newNumJurors - 1
      setArbitratorExtraData(encodeExtraData(courtID ?? 0, newNumJurors))
      setNumberOfJurors(newNumJurors)
    },
    [courtID, setArbitratorExtraData],
  )

  const loadingCourts = courts.length === 0 || typeof courtID !== 'number'
  const cost = formatNative(arbitrationCost)

  return (
    <Stack $gap={20}>
      <FieldGrid>
        <FormField
          id={`${ids}-court`}
          label="Court"
          help="The Kleros court whose jurors rule on this list's disputes."
        >
          {(a11y) => (
            <Select
              {...a11y}
              value={typeof courtID === 'number' ? String(courtID) : ''}
              disabled={loadingCourts}
              placeholder={loadingCourts ? 'Loading courts…' : undefined}
              onChange={onCourtChanged}
              options={courts.map(({ value, label }) => ({
                value: String(value),
                label,
              }))}
            />
          )}
        </FormField>
        <FormField
          id={`${ids}-jurors`}
          label="Jurors in the first round"
          help="Always odd; each extra juror raises the arbitration cost."
        >
          {(a11y) => (
            <Row $gap={14}>
              <RangeInput
                type="range"
                min={MIN_JURORS}
                max={MAX_JURORS}
                step={2}
                value={numberOfJurors}
                aria-label="Number of jurors"
                onChange={(event) =>
                  onNumJurorsChange(Number(event.target.value))
                }
              />
              <JurorsInput
                {...a11y}
                type="text"
                inputMode="numeric"
                value={numberOfJurors}
                onChange={(event) =>
                  onNumJurorsChange(Number(event.target.value))
                }
              />
            </Row>
          )}
        </FormField>
      </FieldGrid>
      <CostLine role="group" aria-label="Arbitration cost">
        <Stack $gap={2}>
          <Label $tone="muted">Arbitration cost</Label>
          <Small $muted>
            Paid up front to open a dispute, refunded to the side that wins.
          </Small>
        </Stack>
        {cost === null ? (
          <SkeletonBlock $height="26px" $width="120px" />
        ) : (
          <CostFigure>
            <AnimatedNumber value={Number(cost)} format={amountFormat(cost)} />
            <small>{nativeCurrency}</small>
          </CostFigure>
        )}
      </CostLine>
    </Stack>
  )
}

export default KlerosParams
