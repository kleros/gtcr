import React, { useState, useCallback, useEffect, useContext } from 'react'
import { useWeb3Context } from 'web3-react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import styled from 'styled-components/macro'
import { Popover, List, Badge, Empty, Icon, Avatar, Button } from 'antd'
import { Link } from 'react-router-dom'
import { ethers } from 'ethers'
import {
  getNotificationIconFor,
  getNotificationColorFor,
  typeToMessage,
  NOTIFICATION_TYPES
} from '../utils/notifications'
import { TrackerContext } from '../bootstrap/tracker-context'

const StyledIcon = styled.div`
  width: 48px;
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
`

const StyledBadge = styled(Badge)`
  .ant-badge-count {
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

const Notifications = () => {
  const { account, networkId } = useWeb3Context()
  const { denyTrackers, allowTrackers, trackersConsentDismissed } = useContext(
    TrackerContext
  )

  const [visible, setVisible] = useState()
  const [notifications, setNotifications] = useState({ notifications: [] })

  const handleVisibleChange = useCallback(v => setVisible(v), [])

  const fetchNotifications = useCallback(() => {
    ;(async () => {
      let result = { notifications: [] }
      if (process.env.REACT_APP_NOTIFICATIONS_API_URL && account && networkId)
        result = await (
          await fetch(
            `${process.env.REACT_APP_NOTIFICATIONS_API_URL}/${networkId}/api/notifications/${account}`
          )
        ).json()

      if (!trackersConsentDismissed)
        result.notifications.push({
          isConsentNotification: true
        })

      result.notifications = result.notifications.reverse()
      setNotifications(result)
    })()
  }, [account, networkId, trackersConsentDismissed])

  const dismissNotification = useCallback(
    n =>
      fetch(
        `${
          process.env.REACT_APP_NOTIFICATIONS_API_URL
        }/${networkId}/api/notification/${ethers.utils.getAddress(account)}/${
          n.notificationID
        }`,
        { method: 'delete' }
      ).then(() => fetchNotifications()),
    [account, networkId, fetchNotifications]
  )

  const dismissAll = useCallback(() => {
    if (!networkId || !account || !process.env.REACT_APP_NOTIFICATIONS_API_URL)
      return
    ;(async () => {
      await fetch(
        `${
          process.env.REACT_APP_NOTIFICATIONS_API_URL
        }/${networkId}/api/notifications/${ethers.utils.getAddress(account)}`,
        { method: 'delete' }
      )
      fetchNotifications()
    })()
  }, [networkId, account, fetchNotifications])

  const notificationClick = useCallback(
    n => {
      fetch(
        `${
          process.env.REACT_APP_NOTIFICATIONS_API_URL
        }/${networkId}/api/notification/${ethers.utils.getAddress(account)}/${
          n.notificationID
        }`,
        { method: 'put' }
      )
        .then(() => fetchNotifications())
        .catch(err => console.error('Failed to fetch notifications', err))
      setVisible(false)
    },
    [account, networkId, fetchNotifications]
  )

  const dismissConsentNotification = useCallback(() => {
    denyTrackers()
    setNotifications(s => ({
      ...s,
      notifications: s.notifications.filter(n => !n.isConsentNotification)
    }))
  }, [denyTrackers])

  // Fetch notifications
  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const content = (
    <StyledList>
      {!notifications.notifications.length >= 1 && (
        <Empty description="All done." image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
      {notifications.notifications.map((n, j) =>
        n.isConsentNotification ? (
          <StyledListItem key={j}>
            <List.Item.Meta
              title="Enable trackers"
              description={
                <div>
                  This helps us improve curate.
                  <Button />
                </div>
              }
              avatar={
                <Avatar
                  style={{ backgroundColor: 'transparent' }}
                  icon={
                    <FontAwesomeIcon
                      icon="info-circle"
                      color={getNotificationColorFor(
                        NOTIFICATION_TYPES.SUBMISSION_ACCEPTED
                      )}
                    />
                  }
                />
              }
            />
          </StyledListItem>
        ) : (
          <StyledListItem
            actions={[
              <Icon type="close" onClick={() => dismissNotification(n)} />
            ]}
            key={j}
          >
            <Link
              to={`/tcr/${n.tcrAddr}/${n.itemID}`}
              onClick={() => notificationClick(n)}
            >
              <List.Item.Meta
                title={
                  <span style={{ color: n.clicked ? '#9b77cc' : '' }}>
                    {typeToMessage[n.type]}
                  </span>
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
        )
      )}
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
            notifications.notifications.filter(n => !n.clicked).length
          }
        >
          <FontAwesomeIcon icon="bell" color="white" size="lg" />
        </StyledBadge>
      </StyledIcon>
    </Popover>
  )
}

export default Notifications
