import React, { useState, useCallback, useEffect } from 'react'
import { useWeb3Context } from 'hooks/use-web3-context'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import styled from 'styled-components'
import { Popover, List, Badge, Empty, Avatar, Button } from 'components/ui'
import Icon from 'components/ui/Icon'
import { Link } from 'react-router-dom'
import { ethers } from 'ethers'
import {
  getNotificationIconFor,
  getNotificationColorFor,
  typeToMessage,
} from '../utils/notifications'

const StyledIcon = styled.div`
  width: 48px;
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
`

const StyledBadge = styled(Badge)`
  .ui-badge-count {
    padding: 0 4px;
  }
`

const StyledList = styled(List)`
  max-height: 300px;
  overflow-y: auto;
`

const StyledTitle = styled.div`
  display: flex;
  justify-content: space-between;
`

const StyledListItem = styled(List.Item)`
  justify-content: space-between;
`

const StyledSpan = styled.span`
  color: ${({ clicked, theme }) =>
    clicked ? theme.textTertiary : theme.textPrimary};
`

const Notifications = () => {
  const { account, networkId } = useWeb3Context()
  const [visible, setVisible] = useState()
  const [notifications, setNotifications] = useState({ notifications: [] })
  const handleVisibleChange = useCallback((v) => setVisible(v), [])
  const fetchNotifications = useCallback(() => {
    ;(async () => {
      try {
        const result = await (
          await fetch(
            `${process.env.REACT_APP_NOTIFICATIONS_API_URL}/${networkId}/api/notifications/${account}`,
          )
        ).json()

        result.notifications = result.notifications.reverse()
        setNotifications(result)
      } catch (err) {
        console.warn('Error fetching notifications', err)
      }
    })()
  }, [account, networkId])
  const dismissNotification = useCallback(
    (n) =>
      fetch(
        `${
          process.env.REACT_APP_NOTIFICATIONS_API_URL
        }/${networkId}/api/notification/${ethers.utils.getAddress(account)}/${
          n.notificationID
        }`,
        { method: 'delete' },
      ).then(() => fetchNotifications()),
    [account, networkId, fetchNotifications],
  )
  const dismissAll = useCallback(() => {
    if (!networkId || !account) return
    ;(async () => {
      await fetch(
        `${
          process.env.REACT_APP_NOTIFICATIONS_API_URL
        }/${networkId}/api/notifications/${ethers.utils.getAddress(account)}`,
        { method: 'delete' },
      )
      fetchNotifications()
    })()
  }, [networkId, account, fetchNotifications])
  const notificationClick = useCallback(
    (n) => {
      fetch(
        `${
          process.env.REACT_APP_NOTIFICATIONS_API_URL
        }/${networkId}/api/notification/${ethers.utils.getAddress(account)}/${
          n.notificationID
        }`,
        { method: 'put' },
      )
        .then(() => fetchNotifications())
        .catch((err) => console.error('Failed to fetch notifications', err))
      setVisible(false)
    },
    [account, networkId, fetchNotifications],
  )

  // Fetch notifications
  useEffect(() => {
    if (!account || !networkId) return
    fetchNotifications()
  }, [account, networkId, fetchNotifications])

  const content = (
    <StyledList>
      {!notifications.notifications.length >= 1 && (
        <Empty description="All done." image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
      {notifications.notifications.map((n, j) => (
        <StyledListItem
          actions={[
            <Icon
              key="close"
              type="close"
              onClick={() => dismissNotification(n)}
            />,
          ]}
          key={j}
        >
          <Link
            to={`/tcr/${n.tcrAddr}/${n.itemID}`}
            onClick={() => notificationClick(n)}
          >
            <List.Item.Meta
              title={
                <StyledSpan clicked={n.clicked}>
                  {typeToMessage[n.type]}
                </StyledSpan>
              }
              avatar={
                <Avatar
                  style={{ backgroundColor: 'transparent' }}
                  icon={
                    <FontAwesomeIcon
                      icon={getNotificationIconFor(n.type)}
                      color={getNotificationColorFor(n.type)}
                    />
                  }
                />
              }
            />
          </Link>
        </StyledListItem>
      ))}
    </StyledList>
  )

  return (
    <Popover
      placement="bottom"
      title={
        <StyledTitle>
          Notifications{' '}
          {notifications.notifications.length > 1 && (
            <Button type="link" size="small" onClick={dismissAll}>
              {' '}
              Dismiss all
            </Button>
          )}
        </StyledTitle>
      }
      content={content}
      trigger="click"
      visible={visible}
      onVisibleChange={handleVisibleChange}
    >
      <StyledIcon style={{ width: '48px', height: '60px' }}>
        <StyledBadge
          count={
            notifications &&
            notifications.notifications.filter((n) => !n.clicked).length
          }
        >
          <FontAwesomeIcon icon="bell" color="white" size="lg" />
        </StyledBadge>
      </StyledIcon>
    </Popover>
  )
}

export default Notifications
