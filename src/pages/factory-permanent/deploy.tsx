import { Card, Button, Alert, Steps } from 'components/ui'
import Icon from 'components/ui/icon'
import { Link } from 'react-router-dom'
import React, { useState } from 'react'
import { parseEther, decodeEventLog } from 'viem'
import { useAccount, usePublicClient, useWalletClient, useChainId } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import styled from 'styled-components'
import _GTCRFactory from 'assets/abis/PermanentGTCRFactory.json'
import ipfsPublish from 'utils/ipfs-publish'
import { getIPFSPath } from 'utils/get-ipfs-path'
import { isVowel } from 'utils/string'
import { wrapWithToast } from 'utils/wrap-with-toast'
import { wagmiConfig } from 'config/wagmi'
import useWindowDimensions from 'hooks/window-dimensions'
import EnsureAuth from 'components/ensure-auth'
import useTcrView from 'hooks/tcr-view'
import {
  defaultEvidenceDisplayUriPermanent,
  defaultTcrAddresses,
  pgtcrFactoryAddresses,
} from 'config/tcr-addresses'

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

const getTcrMetaEvidence = async (tcrState, evidenceDisplayInterfaceURI) => {
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

  const enc = new TextEncoder()

  const ipfsMetaEvidencePath = getIPFSPath(
    await ipfsPublish(
      'meta-evidence.json',
      enc.encode(JSON.stringify(metaEvidenceData)),
    ),
  )

  return {
    ipfsMetaEvidencePath,
  }
}

interface DeployProps {
  setTxState: (tx: Record<string, unknown>) => void
  tcrState: Record<string, unknown>
  setTcrState: (
    fn: (prev: Record<string, unknown>) => Record<string, unknown>,
  ) => void
  [key: string]: unknown
}

const Deploy = ({ setTxState, tcrState, setTcrState }: DeployProps) => {
  const chainId = useChainId()
  const { address: account } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { width } = useWindowDimensions()
  const [currentStep, setCurrentStep] = useState(0)
  const [txSubmitted, setTxSubmitted] = useState<any>()
  const [, setDeployedTCRAddress] = useState<any>()
  const [, setSubmissionFormOpen] = useState<any>()
  const factoryAddress = pgtcrFactoryAddresses[chainId]
  const defaultTCRAddress = defaultTcrAddresses[chainId]
  const evidenceDisplayInterfaceURI =
    defaultEvidenceDisplayUriPermanent[chainId]
  const { metaEvidence } = useTcrView(defaultTCRAddress)

  const onDeploy = async () => {
    try {
      const { ipfsMetaEvidencePath } = await getTcrMetaEvidence(
        tcrState,
        evidenceDisplayInterfaceURI,
      )

      const { request } = await simulateContract(wagmiConfig, {
        address: factoryAddress,
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

      if (result.status) {
        const txHash = result.result.transactionHash
        setTxSubmitted(txHash)

        let contractAddress
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

          if (newGTCRLog) contractAddress = newGTCRLog.args._address
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
                    to={`/tcr/${chainId}/${tcrState.transactions[txSubmitted].contractAddress}`}
                  >
                    {tcrState.transactions[txSubmitted].contractAddress}
                  </Link>
                  .
                </StyledDiv>
                <StyledDiv>
                  You may want to bookmark its address or, if it adheres to the
                  listing criteria,{' '}
                  <Button
                    type="link"
                    onClick={setSubmissionFormOpen}
                    style={{ padding: 0 }}
                  >
                    submit it to{' '}
                    {(metaEvidence && metaEvidence.metadata.tcrTitle) ||
                      'Curated Lists'}{' '}
                    so other users can find it.
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
