import React, { useCallback, useEffect, useId, useMemo, useState } from 'react'
import styled from 'styled-components'
import { ethers, type BigNumber } from 'ethers'
import { abi as _IArbitrator } from '@kleros/erc-792/build/contracts/IArbitrator.json'
import useNativeCurrency from 'hooks/native-currency'
import useCourtPolicies from 'hooks/use-court-policies'
import { useEthersProvider } from 'hooks/ethers-adapters'
import { klerosAddresses } from 'config/tcr-addresses'
import { encodeExtraData, readExtraData } from 'utils/string'
import { ARBITRATION_FEE_TOOLTIP } from 'components/arbitration-fee-tooltip'
import {
  AnimatedNumber,
  amountFormat,
} from 'components/curate/motion/animated-number'
import { formatEther } from 'components/curate/item-standard-format'
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
} from 'components/curate/factory-shared-fields'

/*
 * The Kleros side of both list factories (classic and Stake): which court
 * rules on disputes and how many jurors sit in the first round, encoded into
 * the arbitrator extra data, with the arbitration cost that encoding sets
 * read from the arbitrator contract; and the same court named the same way
 * in each wizard's preview and deploy review.
 */

const { getAddress } = ethers.utils

/** Jurors in the first round: odd numbers from 1 to 33. */
export const JURORS = { min: 1, max: 33, step: 2 } as const

/** Why typed jurors cannot be used (the rules the slider snaps to), or ''. */
export const jurorsProblem = (
  text: string,
  min: number = JURORS.min,
  max: number = JURORS.max,
): string => {
  const typed = text.trim()
  if (!/^\d+$/.test(typed))
    return `Use an odd number between ${min} and ${max}.`
  const count = Number(typed)
  if (count < min || count > max) return `Between ${min} and ${max} jurors.`
  if (count % 2 === 0) return 'Use an odd number.'
  return ''
}

/* ---------- Court summary (preview and review) ---------- */

export type CourtSummary = {
  isKleros: boolean
  /** "xDai Curation", "Court 1" while loading; undefined without extra data. */
  courtName?: string
  jurors?: number
  /** "xDai Curation · 3 jurors", or undefined when there is nothing to name. */
  text?: string
}

/**
 * The court a draft list points at: the court's policy name when the
 * arbitrator is the chain's Kleros arbitrator, "Court N" while the policies
 * load, and the juror count from the extra data.
 */
export const useCourtSummary = (
  chainId: number | undefined,
  arbitratorAddress: string | undefined,
  extraData: string | undefined,
): CourtSummary => {
  const library = useEthersProvider({ chainId })
  const { arbitrator: klerosAddress, policy: policyAddress } =
    (chainId !== undefined && klerosAddresses[chainId]) || {}
  let isKleros = false
  try {
    isKleros =
      getAddress(arbitratorAddress ?? '') === getAddress(klerosAddress ?? '')
  } catch {
    isKleros = false
  }
  const { data: courts = [] } = useCourtPolicies(
    isKleros ? policyAddress : undefined,
    library,
  )
  const extra = useMemo(
    () =>
      extraData && extraData.length >= 130 ? readExtraData(extraData) : null,
    [extraData],
  )

  if (!isKleros || !extra) return { isKleros }
  const courtName =
    courts.find((court) => court.courtID === extra.courtID)?.name ??
    `Court ${extra.courtID}`
  const jurors = extra.numberOfJurors
  return {
    isKleros,
    courtName,
    jurors,
    text: `${courtName} · ${jurors} ${jurors === 1 ? 'juror' : 'jurors'}`,
  }
}

/* ---------- Court and jurors controls ---------- */

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
  /** One line under the cost on who pays it, in the factory's own terms. */
  costNote: string
}

const KlerosParams = ({
  klerosAddress,
  policyAddress,
  setArbitratorExtraData,
  arbitratorExtraData,
  library,
  costNote,
}: KlerosParamsProps) => {
  const ids = useId()
  const nativeCurrency = useNativeCurrency()
  // The last cost read, with the extra data it was read for.
  const [arbitrationCost, setArbitrationCost] = useState<{
    cost: BigNumber
    extraData: string
  } | null>(null)
  const [numberOfJurors, setNumberOfJurors] = useState(3)
  // The jurors as typed, until the box is left or Enter is pressed: each
  // keystroke must not set the court's jurors (clearing "3" to type 5 would
  // pass through 1, then 15).
  const [jurorsText, setJurorsText] = useState<string | null>(null)
  const [jurorsError, setJurorsError] = useState('')
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

  // Load the court and juror count from the arbitrator extra data; extra
  // data that does not decode leaves the controls as they are.
  useEffect(() => {
    const parsed = readExtraData(arbitratorExtraData)
    if (!parsed) return
    setCourtID(parsed.courtID)
    setNumberOfJurors(parsed.numberOfJurors)
  }, [arbitratorExtraData])

  // Another arbitrator or provider: the last figure is not its cost.
  useEffect(() => {
    setArbitrationCost(null)
  }, [arbitrator, library])

  // Read the arbitration cost the current settings set.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!arbitratorExtraData || !arbitrator || !library) return
      try {
        const cost: BigNumber =
          await arbitrator.arbitrationCost(arbitratorExtraData)
        if (!cancelled)
          setArbitrationCost({ cost, extraData: arbitratorExtraData })
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
      let newNumJurors = value > 0 ? value : JURORS.min
      newNumJurors = newNumJurors <= JURORS.max ? newNumJurors : JURORS.max
      if (newNumJurors % 2 === 0) newNumJurors = newNumJurors - 1
      setArbitratorExtraData(encodeExtraData(courtID ?? 0, newNumJurors))
      setNumberOfJurors(newNumJurors)
      setJurorsText(null)
      setJurorsError('')
    },
    [courtID, setArbitratorExtraData],
  )

  // The typed jurors take effect only when they follow the slider's rules;
  // otherwise the box keeps the text and says what to change.
  const commitJurors = () => {
    if (jurorsText === null) return
    const problem = jurorsProblem(jurorsText)
    setJurorsError(problem)
    if (problem) return
    onNumJurorsChange(Number(jurorsText.trim()))
  }

  const courtsReady = courts.length > 0 && typeof courtID === 'number'
  const selectedCourt = courts.find((court) => court.courtID === courtID)
  const cost = arbitrationCost ? formatEther(arbitrationCost.cost) : null
  // While the cost of new settings loads, the last figure is not theirs: it
  // shimmers, then counts up from the last figure to the new one.
  const costIsCurrent = arbitrationCost?.extraData === arbitratorExtraData

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
          error={jurorsError}
          showError={!!jurorsError}
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
                value={jurorsText ?? String(numberOfJurors)}
                onChange={(event) => {
                  setJurorsText(event.target.value)
                  setJurorsError('')
                }}
                onBlur={commitJurors}
                onKeyDown={(event) => {
                  // Enter sets the jurors; it does not leave the step.
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  commitJurors()
                }}
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
            {costNote}
          </Small>
        </Stack>
        {cost === null ? (
          <SkeletonBlock $height="26px" $width="120px" />
        ) : (
          <CostFigure>
            <AnimatedNumber
              value={Number(cost)}
              format={amountFormat(cost)}
              loading={!costIsCurrent}
            />
            <small>{nativeCurrency}</small>
          </CostFigure>
        )}
      </CostLine>
    </Stack>
  )
}

export default KlerosParams
