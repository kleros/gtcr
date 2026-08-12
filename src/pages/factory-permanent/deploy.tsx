import { Card, Button, Alert, Steps } from 'components/ui'
import Icon from 'components/ui/Icon'
import { Link } from 'react-router-dom'
import React, { useState } from 'react'
import { parseEther, decodeEventLog, type Address } from 'viem'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import styled from 'styled-components'
import _GTCRFactory from 'assets/abis/PermanentGTCRFactory.json'
import { Roles, useAtlasProvider } from '@kleros/kleros-app'
import { JSON_UPLOAD_ROLE } from 'utils/atlas-roles'
import { isVowel } from 'utils/string'
import { wrapWithToast, errorToast } from 'utils/wrap-with-toast'
import { parseWagmiError } from 'utils/parse-wagmi-error'
import { wagmiConfig } from 'config/wagmi'
import useWindowDimensions from 'hooks/window-dimensions'
import EnsureAuth from 'components/ensure-auth'
import useLightTcrView from 'hooks/light-tcr-view'
import {
  defaultEvidenceDisplayUriPermanent,
  defaultTcrAddresses,
  pgtcrFactoryAddresses,
} from 'config/tcr-addresses'
import type { StepProps, TcrState } from '.'

export const StyledDiv = styled.div`
  word-break: break-all;
`

export const StyledSteps = styled(Steps)`
  margin: 24px 0;
`

export const StyledAlert = styled(Alert)`
  margin-bottom: 24px;
`

export const StyledCard = styled(Card)`
  & > .ui-card-body {
    display: flex;
    flex-direction: column;
  }
`

export const StyledActions = styled.div`
  display: flex;
  justify-content: flex-end;
`

export const StyledButton = styled(Button)`
  margin-left: 12px;
  text-transform: capitalize;
`

export const StyledSpan = styled.span`
  display: flex;
  align-items: center;
  justify-content: flex-end;
`

const getTcrMetaEvidence = async (
  tcrState: TcrState,
  evidenceDisplayInterfaceURI: string,
  uploadFile: (file: File, role: Roles) => Promise<string | null>,
) => {
  const {
    tcrTitle,
    tcrDescription,
    columns,
    itemName,
    itemNamePlural,
    tcrPrimaryDocument,
    tcrLogo,
  } = tcrState
  const metadata = {
    tcrTitle,
    tcrDescription,
    columns,
    itemName: itemName.toLowerCase(),
    itemNamePlural: itemNamePlural.toLowerCase(),
    logoURI: tcrLogo,
    requireRemovalEvidence: true,
  }

  const commonMetaEvidenceProps = {
    category: 'Curated Lists',
    question: `Does the ${
      (itemName && itemName.toLowerCase()) || 'item'
    } comply with the required criteria?`,
    fileURI: tcrPrimaryDocument,
    evidenceDisplayInterfaceURI,
    metadata,
  }

  const metaEvidenceData = {
    title: `Keep ${
      itemName
        ? isVowel(itemName[0])
          ? `an ${itemName.toLowerCase()}`
          : `a ${itemName.toLowerCase()}`
        : 'an item'
    } in ${tcrTitle}`,
    description: `Someone requested to remove ${
      itemName
        ? isVowel(itemName[0])
          ? `an ${itemName.toLowerCase()}`
          : `a ${itemName.toLowerCase()}`
        : 'an item'
    } from ${tcrTitle}`,
    rulingOptions: {
      titles: ['Yes, Keep It Included', 'No, Remove It'],
      descriptions: [
        `Select this if you think the ${
          (itemName && itemName.toLowerCase()) || 'item'
        } complies with the required criteria and should be kept included.`,
        `Select this if you think the ${
          (itemName && itemName.toLowerCase()) || 'item'
        } does not comply with the required criteria and should be removed.`,
      ],
    },
    ...commonMetaEvidenceProps,
  }

  const metaEvidenceFile = new File(
    [JSON.stringify(metaEvidenceData)],
    'meta-evidence.json',
    { type: 'application/json' },
  )
  const ipfsMetaEvidencePath = await uploadFile(
    metaEvidenceFile,
    JSON_UPLOAD_ROLE,
  )
  if (!ipfsMetaEvidencePath)
    throw new Error('Failed to upload meta-evidence to IPFS.')

  return {
    ipfsMetaEvidencePath,
  }
}

type DeployProps = StepProps

const Deploy = ({ setTxState, tcrState, setTcrState }: DeployProps) => {
  const chainId = useChainId()
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { width } = useWindowDimensions()
  const [currentStep, setCurrentStep] = useState(0)
  const [txSubmitted, setTxSubmitted] = useState<string>()
  const [, setDeployedTCRAddress] = useState<string>()
  const [, setSubmissionFormOpen] = useState(false)
  const factoryAddress = pgtcrFactoryAddresses[chainId]
  const defaultTCRAddress = defaultTcrAddresses[chainId]
  const evidenceDisplayInterfaceURI =
    defaultEvidenceDisplayUriPermanent[chainId]
  const { metaEvidence } = useLightTcrView(defaultTCRAddress ?? '')
  const { uploadFile } = useAtlasProvider()

  const onDeploy = async () => {
    if (
      !factoryAddress ||
      !evidenceDisplayInterfaceURI ||
      !publicClient ||
      !walletClient
    )
      return
    const factory = factoryAddress as Address
    try {
      const { ipfsMetaEvidencePath } = await getTcrMetaEvidence(
        tcrState,
        evidenceDisplayInterfaceURI,
        uploadFile,
      )

      const { request } = await simulateContract(wagmiConfig, {
        address: factory,
        abi: _GTCRFactory,
        functionName: 'deploy',
        args: [
          tcrState.arbitratorAddress,
          tcrState.arbitratorExtraData,
          ipfsMetaEvidencePath,
          tcrState.governorAddress,
          tcrState.tokenAddress,
          parseEther(tcrState.submissionMinDeposit.toString()),
          [
            Number(tcrState.submissionPeriodDuration) * 60 * 60,
            Number(tcrState.reinclusionPeriodDuration) * 60 * 60,
            Number(tcrState.withdrawingPeriodDuration) * 60 * 60,
            Number(tcrState.arbitrationParamsCooldown) * 60 * 60,
          ],
          [
            Math.ceil(Number(tcrState.sharedStakeMultiplier)) * 100,
            Math.ceil(Number(tcrState.winnerStakeMultiplier)) * 100,
            Math.ceil(Number(tcrState.loserStakeMultiplier)) * 100,
            Math.ceil(Number(tcrState.challengeStakeMultiplier)) * 100,
          ],
        ],
        gas: 8000000n,
        account,
      })

      setCurrentStep(1)

      const result = await wrapWithToast(
        () => walletClient.writeContract(request),
        publicClient,
      )

      if (result.status && result.result) {
        const txHash = result.result.transactionHash
        setTxSubmitted(txHash)

        let contractAddress: string | undefined
        try {
          const newGTCRLog = result.result.logs
            .map((log) => {
              try {
                return decodeEventLog({
                  abi: _GTCRFactory,
                  data: log.data,
                  topics: log.topics,
                })
              } catch {
                return null
              }
            })
            .find((parsed) => parsed && parsed.eventName === 'NewGTCR')

          const pickAddress = (args: unknown): string | undefined =>
            args && typeof args === 'object' && '_address' in args
              ? ((args as { _address?: string })._address ?? undefined)
              : undefined
          if (newGTCRLog) contractAddress = pickAddress(newGTCRLog.args)
        } catch (err) {
          console.error('Error parsing deploy logs:', err)
        }

        setTxState({
          txHash,
          status: 'mined',
          contractAddress,
        })
        setTcrState((prevState) => ({
          ...prevState,
          finished: true,
        }))
        setCurrentStep(2)
        setDeployedTCRAddress(contractAddress)
      }
    } catch (err) {
      console.error('Error deploying list:', err)
      errorToast(parseWagmiError(err))
    }
  }

  return (
    <>
      <StyledCard title="Deploy the list">
        {currentStep === 0 && (
          <StyledAlert
            showIcon
            type="info"
            closable
            message="On your marks..."
            description="When you are ready, click deploy. You may also want to add it to The Registry so people can find it. If so, don't close the window and wait for the transaction to mine."
          />
        )}
        {currentStep === 1 && (
          <StyledAlert
            showIcon
            type="info"
            closable
            message="Deploy in progress. Please do not close the window until the process is finished."
          />
        )}
        <StyledSteps
          current={currentStep}
          direction={width < 750 ? 'vertical' : 'horizontal'}
        >
          <Steps.Step
            title="Start"
            description={currentStep > 0 && 'Finished'}
            icon={<Icon type="fire" />}
          />
          <Steps.Step
            title="Deploying list"
            description={currentStep > 1 && 'Finished'}
            icon={
              currentStep < 1 ? (
                <Icon type="star" />
              ) : currentStep === 1 ? (
                <Icon type="loading" />
              ) : (
                <Icon type="check" />
              )
            }
          />
          <Steps.Step title="Finished!" icon={<Icon type="flag" />} />
        </StyledSteps>
        {currentStep === 2 && (
          <StyledAlert
            type="success"
            showIcon
            message="Success!"
            description={
              <>
                <StyledDiv>
                  Your list was created at the following address:{' '}
                  <Link
                    to={`/tcr/${chainId}/${
                      (txSubmitted &&
                        tcrState.transactions[txSubmitted]?.contractAddress) ||
                      ''
                    }`}
                  >
                    {(txSubmitted &&
                      tcrState.transactions[txSubmitted]?.contractAddress) ||
                      ''}
                  </Link>
                  .
                </StyledDiv>
                <StyledDiv>
                  You may want to bookmark its address or, if it adheres to the
                  listing criteria,{' '}
                  <Button
                    type="link"
                    onClick={() => setSubmissionFormOpen(true)}
                    style={{ padding: 0 }}
                  >
                    submit it to{' '}
                    {metaEvidence?.metadata?.tcrTitle || 'Curated Lists'} so
                    other users can find it.
                  </Button>
                </StyledDiv>
              </>
            }
          />
        )}
        {currentStep === 0 && (
          <StyledSpan>
            <StyledActions>
              <EnsureAuth>
                <StyledButton
                  type="primary"
                  onClick={onDeploy}
                  icon={
                    currentStep === 0 || currentStep === 2 ? 'fire' : 'loading'
                  }
                >
                  Deploy!
                </StyledButton>
              </EnsureAuth>
            </StyledActions>
          </StyledSpan>
        )}
      </StyledCard>
    </>
  )
}

export default Deploy
