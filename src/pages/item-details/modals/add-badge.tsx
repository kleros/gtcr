import React, { useState, useCallback, useEffect } from 'react'
import { BigNumber } from 'ethers'
import { Button, Typography, Descriptions, List } from 'components/ui'
import { parseIpfs } from 'utils/ipfs-parse'
import ETHAmount from 'components/eth-amount'
import useNativeCurrency from 'hooks/native-currency'
import {
  StyledListingCriteriaLink,
  ButtonContainer,
  StyledModal,
  StyledSpin,
  StyledRadioGroup,
  StyledRadio,
  StyledListItem,
} from 'pages/light-item-details/modals/add-badge'

export interface BadgeInfo {
  tcrAddress: string
  fileURI?: string
  submissionDeposit: BigNumber
  metadata: { tcrTitle: string; logoURI: string; columns: Column[] }
  matchFile?: { columns: (number | null)[] }
  decodedData?: unknown[]
  metaEvidence?: MetaEvidence
  challengePeriodDuration?: BigNumber
  [key: string]: unknown
}

interface AddBadgeModalProps {
  onCancel: () => void
  availableBadges?: BadgeInfo[]
  visible?: boolean
  tcrAddress?: string
  connectedTCRAddr?: string
  onSelectBadge: (badge: BadgeInfo) => void
  onEnableNewBadge: () => void
  isFetchingBadges?: boolean
  foundBadges?: { tcrAddress: string }[]
}

const AddBadgeModal = ({
  onCancel,
  availableBadges,
  visible,
  tcrAddress,
  connectedTCRAddr,
  onSelectBadge,
  onEnableNewBadge,
  isFetchingBadges,
  foundBadges,
}: AddBadgeModalProps) => {
  const nativeCurrency = useNativeCurrency()
  const [selectedBadge, setSelectedBadge] = useState<number>()
  const handleSubmit = useCallback(() => {
    if (!availableBadges || selectedBadge === undefined) return
    onSelectBadge(availableBadges[selectedBadge])
    onCancel()
  }, [availableBadges, onCancel, onSelectBadge, selectedBadge])

  const handleEnableNewBadge = useCallback(() => {
    onCancel()
    onEnableNewBadge()
  }, [onCancel, onEnableNewBadge])

  const filteredAvailableBadges = (availableBadges ?? []).filter(
    ({ tcrAddress: availableBadgeAddr }) =>
      !(foundBadges ?? [])
        .map((b) => b.tcrAddress)
        .includes(availableBadgeAddr),
  )

  // The radio button doesn't trigger onSelectBadge when displayed,
  // which can cause inconsistency between the what is displayed on the UI
  // and the component state (i.e. it shows A is selected, but actually B is).
  // To get around this, once we have a list of available badges loaded,
  // explicitly select it.
  useEffect(() => {
    if (!filteredAvailableBadges || filteredAvailableBadges.length === 0) return
    setSelectedBadge(0)
  }, [availableBadges, filteredAvailableBadges, onSelectBadge])

  if (!availableBadges || !tcrAddress || !connectedTCRAddr || isFetchingBadges)
    return (
      <StyledModal
        title="Add Badge"
        visible={visible}
        footer={[
          <Button key="back" onClick={onCancel}>
            Cancel
          </Button>,
        ]}
        onCancel={onCancel}
      >
        <StyledSpin />
      </StyledModal>
    )

  return (
    <StyledModal
      title="Add Badge"
      visible={visible}
      onCancel={onCancel}
      footer={[
        <Button key="back" onClick={onCancel}>
          Cancel
        </Button>,
        <Button
          key="add-badge"
          type="primary"
          onClick={handleSubmit}
          disabled={typeof selectedBadge === 'undefined'}
        >
          Add Badge
        </Button>,
      ]}
    >
      <StyledRadioGroup
        onChange={(e) => setSelectedBadge(Number(e.target.value))}
        value={selectedBadge}
      >
        {filteredAvailableBadges.map(
          ({ fileURI, metadata: { tcrTitle, logoURI } }, i) => (
            <StyledRadio value={i} key={i}>
              <StyledListItem>
                <List.Item.Meta
                  avatar={
                    <img width={50} alt="logo" src={parseIpfs(logoURI)} />
                  }
                  title={tcrTitle}
                  description={
                    <>
                      Read the&nbsp;
                      <StyledListingCriteriaLink fileURI={fileURI}>
                        Listing Criteria
                      </StyledListingCriteriaLink>
                    </>
                  }
                />
              </StyledListItem>
            </StyledRadio>
          ),
        )}
        {filteredAvailableBadges.length === 0 && (
          <div>No badges available for this list</div>
        )}
      </StyledRadioGroup>
      <ButtonContainer>
        <Button
          type="link"
          onClick={handleEnableNewBadge}
          style={{ padding: 0 }}
        >
          Enable a new badge
        </Button>
      </ButtonContainer>
      {filteredAvailableBadges.length > 0 && (
        <>
          <Typography.Paragraph>
            A deposit is required to submit. This value reimbursed at the end of
            the challenge period or, if there is a dispute, be awarded to the
            party that wins.
          </Typography.Paragraph>
          <Descriptions
            bordered
            column={{ xxl: 4, xl: 3, lg: 3, md: 3, sm: 2, xs: 1 }}
            style={{ marginBottom: '16px' }}
          >
            <Descriptions.Item label="Total Deposit Required">
              <ETHAmount
                decimals={3}
                amount={
                  typeof selectedBadge !== 'undefined'
                    ? availableBadges[
                        selectedBadge
                      ].submissionDeposit.toString()
                    : 0
                }
                displayUnit={` ${nativeCurrency}`}
              />
            </Descriptions.Item>
          </Descriptions>
        </>
      )}
    </StyledModal>
  )
}

export default AddBadgeModal
