import React, { useCallback, useEffect, useId, useMemo, useState } from 'react'
import styled from 'styled-components'
import { ethers, type BigNumber } from 'ethers'
import { abi as _IArbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'
import useNativeCurrency from 'hooks/native-currency'
import useCourtPolicies from 'hooks/use-court-policies'
import { ARBITRATION_FEE_TOOLTIP } from 'components/arbitration-fee-tooltip'
import { AnimatedNumber } from 'components/curate/motion/animated-number'
import {
  Label,
  Row,
  SkeletonBlock,
  Small,
  Stack,
} from 'components/curate/primitives'
import { FieldGrid, FormField, Input, RangeInput, Select } from './controls'
import { JURORS } from './defaults'
import {
  amountFormat,
  encodeExtraData,
  formatNative,
  readExtraData,
} from './format'

/*
 * The Kleros side of the arbitrator settings: which court rules on disputes
 * and how many jurors sit in the first round. Both are encoded into the
 * arbitrator extra data; the arbitration cost that encoding sets is read
 * from the arbitrator contract and shown as one figure under the controls.
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
  white-space: nowrap;

  small {
    margin-left: 6px;
    color: var(--color-muted);
    font-size: var(--fs-small);
    font-weight: 500;
    letter-spacing: 0;
  }
`

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
  const [arbitrationCost, setArbitrationCost] = useState<BigNumber | null>(null)
  const [numberOfJurors, setNumberOfJurors] = useState(3)
  const [courtID, setCourtID] = useState<number>()
  const { data: courts = [], isLoading: loadingCourts } = useCourtPolicies(
    policyAddress,
    library,
  )

  const arbitrator = useMemo(() => {
    if (!klerosAddress || !library) return
    try {
      return new ethers.Contract(klerosAddress, _IArbitrator, library)
    } catch (err) {
      console.warn(`Failed to connect to kleros at ${klerosAddress}`, err)
      return null
    }
  }, [library, klerosAddress])

  // Load the court and juror count from the arbitrator extra data.
  useEffect(() => {
    const parsed = readExtraData(arbitratorExtraData)
    if (!parsed) return
    setCourtID(parsed.courtID)
    setNumberOfJurors(parsed.numberOfJurors)
  }, [arbitratorExtraData])

  // Read the arbitration cost the current settings set.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!arbitratorExtraData || !arbitrator || !library) return
      try {
        const cost: BigNumber =
          await arbitrator.arbitrationCost(arbitratorExtraData)
        if (!cancelled) setArbitrationCost(cost)
      } catch (err) {
        console.warn('Failed to read the arbitration cost', err)
        if (!cancelled) setArbitrationCost(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [library, arbitrator, arbitratorExtraData])

  const onCourtChanged = useCallback(
    (value: string) => {
      const newCourtID = Number(value)
      if (value === '' || Number.isNaN(newCourtID)) return
      setArbitratorExtraData(encodeExtraData(newCourtID, numberOfJurors))
      setCourtID(newCourtID)
    },
    [numberOfJurors, setArbitratorExtraData],
  )

  const onNumJurorsChange = useCallback(
    (value: number) => {
      if (Number.isNaN(value)) return
      let newNumJurors = value > 0 ? value : 1
      newNumJurors = newNumJurors < 35 ? newNumJurors : 33
      if (newNumJurors % 2 === 0) newNumJurors = newNumJurors - 1
      setArbitratorExtraData(encodeExtraData(courtID ?? 0, newNumJurors))
      setNumberOfJurors(newNumJurors)
    },
    [courtID, setArbitratorExtraData],
  )

  const courtsReady = courts.length > 0 && typeof courtID === 'number'
  const selectedCourt = courts.find((court) => court.courtID === courtID)
  const cost = arbitrationCost ? formatNative(arbitrationCost) : null

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
              value={courtsReady ? String(courtID) : ''}
              disabled={!courtsReady}
              placeholder={
                courtsReady
                  ? undefined
                  : loadingCourts
                    ? 'Loading courts…'
                    : 'No courts found'
              }
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
                aria-label="Number of jurors slider"
                min={JURORS.min}
                max={JURORS.max}
                step={JURORS.step}
                value={numberOfJurors}
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
        <Stack $gap={2} style={{ minWidth: 0, flex: '1 1 260px' }}>
          <Label $tone="muted">
            Arbitration cost · {numberOfJurors}{' '}
            {numberOfJurors === 1 ? 'juror' : 'jurors'}
            {selectedCourt ? ` in ${selectedCourt.name}` : ''}
          </Label>
          <Small $muted title={ARBITRATION_FEE_TOOLTIP}>
            Each submitter deposits it with the entry and each challenger pays
            it to open a dispute; the winning side ends up with it back.
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
