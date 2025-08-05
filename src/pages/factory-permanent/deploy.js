import { Card, Button, Alert, Icon, Steps } from 'antd'
import { Link } from 'react-router-dom'
import React, { useContext, useState } from 'react'
import { ethers } from 'ethers'
import { parseEther } from 'ethers/utils'
import styled from 'styled-components'
import { useWeb3Context } from 'web3-react'
import _GTCRFactory from 'assets/abis/PermanentGTCRFactory.json'
import ipfsPublish from 'utils/ipfs-publish'
import { getIPFSPath } from 'utils/get-ipfs-path'
import { isVowel } from 'utils/string'
import { WalletContext } from 'contexts/wallet-context'
import useWindowDimensions from 'hooks/window-dimensions'
import useTcrView from 'hooks/tcr-view'
import {
  defaultEvidenceDisplayUriPermanent,
  defaultTcrAddresses,
  pgtcrFactoryAddresses
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
  & > .ant-card-body {
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

export const _txBatcher = [
  {
    constant: false,
    inputs: [
      { name: 'targets', type: 'address[]' },
      { name: 'values', type: 'uint256[]' },
      { name: 'datas', type: 'bytes[]' }
    ],
    name: 'batchSend',
    outputs: [],
    payable: true,
    stateMutability: 'payable',
    type: 'function'
  }
]

const getTcrMetaEvidence = async (tcrState, evidenceDisplayInterfaceURI) => {
  const {
    tcrTitle,
    tcrDescription,
    columns,
    itemName,
    itemNamePlural,
    tcrPrimaryDocument,
    tcrLogo
  } = tcrState
  const metadata = {
    tcrTitle,
    tcrDescription,
    columns,
    itemName: itemName.toLowerCase(),
    itemNamePlural: itemNamePlural.toLowerCase(),
    logoURI: tcrLogo,
    requireRemovalEvidence: true
  }

  const commonMetaEvidenceProps = {
    category: 'Curated Lists',
    question: `Does the ${(itemName && itemName.toLowerCase()) ||
      'item'} comply with the required criteria?`,
    fileURI: tcrPrimaryDocument,
    evidenceDisplayInterfaceURI,
    metadata
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
        `Select this if you think the ${(itemName && itemName.toLowerCase()) ||
          'item'} complies with the required criteria and should be kept included.`,
        `Select this if you think the ${(itemName && itemName.toLowerCase()) ||
          'item'} does not comply with the required criteria and should be removed.`
      ]
    },
    ...commonMetaEvidenceProps
  }

  const enc = new TextEncoder()

  const ipfsMetaEvidencePath = getIPFSPath(
    await ipfsPublish(
      'meta-evidence.json',
      enc.encode(JSON.stringify(metaEvidenceData))
    )
  )

  return {
    ipfsMetaEvidencePath
  }
}

const Deploy = ({ setTxState, tcrState, setTcrState }) => {
  const { networkId } = useWeb3Context()
  const { pushWeb3Action } = useContext(WalletContext)
  const { width } = useWindowDimensions()
  const [currentStep, setCurrentStep] = useState(0)
  const [txSubmitted, setTxSubmitted] = useState()
  const [, setDeployedTCRAddress] = useState()
  const [, setSubmissionFormOpen] = useState()
  const factoryAddress = pgtcrFactoryAddresses[networkId]
  const defaultTCRAddress = defaultTcrAddresses[networkId]
  const evidenceDisplayInterfaceURI =
    defaultEvidenceDisplayUriPermanent[networkId]
  const { metaEvidence } = useTcrView(defaultTCRAddress)

  const onDeploy = () => {
    pushWeb3Action(async (_, signer) => {
      const { ipfsMetaEvidencePath } = await getTcrMetaEvidence(
        tcrState,
        evidenceDisplayInterfaceURI
      )

      const factory = new ethers.Contract(factoryAddress, _GTCRFactory, signer)

      const deployTx = await factory.deploy(
        tcrState.arbitratorAddress,
        tcrState.arbitratorExtraData,
        ipfsMetaEvidencePath,
        tcrState.governorAddress,
        '0xaf204776c7245bF4147c2612BF6e5972Ee483701', // temp, the sDAI address. todov2
        parseEther(tcrState.submissionMinDeposit.toString()),
        [
          Number(tcrState.submissionPeriodDuration) * 60 * 60,
          Number(tcrState.reinclusionPeriodDuration) * 60 * 60,
          Number(tcrState.withdrawingPeriodDuration) * 60 * 60,
          Number(tcrState.arbitrationParamsCooldown) * 60 * 60
        ],
        [
          Math.ceil(Number(tcrState.sharedStakeMultiplier)) * 100,
          Math.ceil(Number(tcrState.winnerStakeMultiplier)) * 100,
          Math.ceil(Number(tcrState.loserStakeMultiplier)) * 100,
          Math.ceil(Number(tcrState.challengeStakeMultiplier)) * 100
        ], // Shared, winner and loser stake multipliers in basis points.
        {
          gasLimit: 8000000
        }
      )

      setCurrentStep(1)
      setTxState({ txHash: deployTx.hash, status: 'pending', networkId })
      setTxSubmitted(deployTx.hash)
      return {
        tx: deployTx,
        actionMessage: 'Deploying List',
        deployTCR: true,
        onTxMined: async ({ contractAddress }) => {
          setTxState({
            txHash: deployTx.hash,
            status: 'mined',
            contractAddress
          })
          setTcrState(prevState => ({
            ...prevState,
            finished: true
          }))
          setCurrentStep(2)
          setDeployedTCRAddress(contractAddress)
        }
      }
    })
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
                    to={`/tcr/${networkId}/${tcrState.transactions[txSubmitted].contractAddress}`}
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
              <StyledButton
                type="primary"
                onClick={onDeploy}
                icon={
                  currentStep === 0 || currentStep === 2 ? 'fire' : 'loading'
                }
              >
                Deploy!
              </StyledButton>
            </StyledActions>
          </StyledSpan>
        )}
      </StyledCard>
    </>
  )
}

export default Deploy
