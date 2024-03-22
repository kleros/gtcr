import React, { useState, useCallback, useEffect } from 'react'
import { Button, Typography, Descriptions, List } from 'antd'
import PropTypes from 'prop-types'
import ETHAmount from 'components/eth-amount'
import useNativeCurrency from 'hooks/native-currency.js'
import { parseIpfs } from 'utils/ipfs-parse'
import {
  StyledA,
  ButtonContainer,
  StyledModal,
  StyledSpin,
  StyledRadioGroup,
  StyledRadio,
  StyledListItem
} from 'pages/light-item-details/modals/add-badge'

const AddBadgeModal = ({
  onCancel,
  availableBadges,
  visible,
  tcrAddress,
  connectedTCRAddr,
  onSelectBadge,
  onEnableNewBadge,
  isFetchingBadges,
  foundBadges
}) => {
  const nativeCurrency = useNativeCurrency()
  const [selectedBadge, setSelectedBadge] = useState()
  const handleSubmit = useCallback(() => {
    onSelectBadge(availableBadges[selectedBadge])
    onCancel()
  }, [availableBadges, onCancel, onSelectBadge, selectedBadge])

  const handleEnableNewBadge = useCallback(() => {
    onCancel()
    onEnableNewBadge()
  }, [onCancel, onEnableNewBadge])

  const filteredAvailableBadges =
    availableBadges &&
    availableBadges.filter(
      ({ tcrAddress: availableBadgeAddr }) =>
        !foundBadges.map(b => b.tcrAddress).includes(availableBadgeAddr)
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
          </Button>
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
        </Button>
      ]}
    >
      <StyledRadioGroup
        onChange={e => setSelectedBadge(e.target.value)}
        value={selectedBadge}
      >
        {filteredAvailableBadges.map(
          ({ fileURI, metadata: { tcrTitle, logoURI } }, i) => (
            <StyledRadio value={i} key={i}>
              <StyledListItem
                extra={<img width={50} alt="logo" src={parseIpfs(logoURI)} />}
              >
                <List.Item.Meta
                  title={tcrTitle}
                  description={
                    <>
                      Read the&nbsp;
                      <StyledA href={parseIpfs(fileURI || '')}>
                        Listing Criteria
                      </StyledA>
                    </>
                  }
                />
              </StyledListItem>
            </StyledRadio>
          )
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

AddBadgeModal.propTypes = {
  onCancel: PropTypes.func.isRequired,
  availableBadges: PropTypes.arrayOf(PropTypes.any),
  foundBadges: PropTypes.arrayOf(PropTypes.any),
  visible: PropTypes.bool,
  tcrAddress: PropTypes.string,
  connectedTCRAddr: PropTypes.string,
  onSelectBadge: PropTypes.func.isRequired,
  onEnableNewBadge: PropTypes.func.isRequired,
  isFetchingBadges: PropTypes.bool
}

AddBadgeModal.defaultProps = {
  availableBadges: null,
  foundBadges: [],
  visible: null,
  tcrAddress: null,
  connectedTCRAddr: null,
  isFetchingBadges: null
}

export default AddBadgeModal
